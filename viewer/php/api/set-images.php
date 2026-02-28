<?php
/**
 * POST /api/set-images
 * Body: { id: string, urls: string[] }
 *
 * Downloads each image URL, converts to JPEG (max 1200px, q85) using GD,
 * and saves to data/images/<id>/, replacing any existing images.
 * Updates both the recipe JSON and index.json.
 *
 * Returns: { images: RecipeImage[] }
 * Errors:  { error: string }
 *
 * HTTP status codes:
 *   200 — success
 *   400 — missing/invalid input
 *   404 — recipe not found
 *   422 — image download or processing failed
 *   503 — server misconfiguration
 */

header('Content-Type: application/json; charset=utf-8');

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonError(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

/** Block private/internal IP ranges to prevent SSRF. */
function assertNotPrivateUrl(string $url): void
{
    $host = parse_url($url, PHP_URL_HOST);
    if ($host === false || $host === null || $host === '') {
        throw new RuntimeException('Invalid URL host.');
    }

    $ip = gethostbyname($host);
    if ($ip === $host && !filter_var($host, FILTER_VALIDATE_IP)) {
        return; // unresolvable — let fetch fail naturally
    }

    $privateRanges = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8',
        '169.254.0.0/16',
    ];

    foreach ($privateRanges as $range) {
        [$rangeIp, $prefix] = explode('/', $range);
        $rangeStart = ip2long($rangeIp);
        $mask       = ~((1 << (32 - (int)$prefix)) - 1);
        $resolved   = ip2long($ip);
        if ($resolved !== false && ($resolved & $mask) === ($rangeStart & $mask)) {
            throw new RuntimeException('URL resolves to a private or reserved address.');
        }
    }
}

/**
 * Download an image URL and return its raw bytes.
 * Throws RuntimeException on failure.
 */
function fetchImageBytes(string $url): string
{
    assertNotPrivateUrl($url);

    $context = stream_context_create([
        'http' => [
            'method'          => 'GET',
            'header'          => "User-Agent: Mozilla/5.0 (compatible; RecipeExtractor/1.0)\r\n",
            'timeout'         => 15,
            'follow_location' => true,
            'max_redirects'   => 3,
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);

    // Limit download to 20 MB to prevent memory exhaustion from large files
    $data = @file_get_contents($url, false, $context, 0, 20_971_520);
    if ($data === false || $data === '') {
        throw new RuntimeException("Failed to download: {$url}");
    }

    if (!empty($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $status = (int)$m[1];
            if ($status >= 400) {
                throw new RuntimeException("Image URL returned HTTP {$status}: {$url}");
            }
        }
    }

    return $data;
}

/**
 * Resize image bytes to max 1200px width (proportional), return JPEG bytes.
 * Requires GD extension. Throws RuntimeException on failure.
 *
 * @return array{data: string, width: int, height: int}
 */
function processImageToJpeg(string $bytes): array
{
    if (!function_exists('imagecreatefromstring')) {
        throw new RuntimeException('GD extension is not available on this server.');
    }

    $src = @imagecreatefromstring($bytes);
    if ($src === false) {
        throw new RuntimeException('Could not decode image (unsupported format or corrupt data).');
    }

    $origW = imagesx($src);
    $origH = imagesy($src);

    $maxW = 1200;
    if ($origW <= $maxW) {
        $dstW = $origW;
        $dstH = $origH;
        $dst  = $src;
    } else {
        $dstW = $maxW;
        $dstH = (int)round($origH * ($maxW / $origW));
        $dst  = imagecreatetruecolor($dstW, $dstH);
        if ($dst === false) {
            imagedestroy($src);
            throw new RuntimeException('Failed to create resized image buffer.');
        }
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $dstW, $dstH, $origW, $origH);
        imagedestroy($src);
    }

    ob_start();
    imagejpeg($dst, null, 85);
    $jpeg = ob_get_clean();
    imagedestroy($dst);

    if ($jpeg === false || $jpeg === '') {
        throw new RuntimeException('Failed to encode image as JPEG.');
    }

    return ['data' => $jpeg, 'width' => $dstW, 'height' => $dstH];
}

/** Atomic write of a file via temp + rename. */
function atomicWrite(string $path, string $content): void
{
    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $content) === false) {
        throw new RuntimeException("Failed to write: {$path}");
    }
    if (!rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException("Failed to finalize write: {$path}");
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

set_exception_handler(function (Throwable $e) {
    error_log('set-images uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(503);
    echo json_encode(['error' => 'Unexpected server error: ' . $e->getMessage()]);
    exit;
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError(405, 'Method not allowed');
}

$body  = (string)file_get_contents('php://input');
$input = json_decode($body, true);
if (!is_array($input)) {
    jsonError(400, 'Request body must be a JSON object');
}

$id = trim($input['id'] ?? '');
if ($id === '') {
    jsonError(400, 'Missing required field: id');
}

// Basic UUID format check
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
    jsonError(400, 'Invalid recipe id format');
}

$urls = $input['urls'] ?? [];
if (!is_array($urls) || count($urls) === 0) {
    jsonError(400, 'urls must be a non-empty array');
}

foreach ($urls as $url) {
    if (!is_string($url) || trim($url) === '') {
        jsonError(400, 'Each URL must be a non-empty string');
    }
    $parsed = parse_url($url);
    if (!$parsed || !in_array($parsed['scheme'] ?? '', ['http', 'https'], true)) {
        jsonError(400, "URL must use http or https: {$url}");
    }
}

// Resolve data directory
$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');
if (!$dataDir) {
    jsonError(503, 'Data directory not found');
}

$recipesDir = $dataDir . '/recipes';
$imagesDir  = $dataDir . '/images';
$recipePath = $recipesDir . '/' . $id . '.json';
$indexPath  = $recipesDir . '/index.json';

// Verify recipe exists
if (!is_file($recipePath)) {
    jsonError(404, 'Recipe not found');
}

// Phase 1: download + process all images to memory — no disk writes yet
$processed = [];
foreach ($urls as $i => $url) {
    try {
        $bytes  = fetchImageBytes($url);
        $result = processImageToJpeg($bytes);
    } catch (RuntimeException $e) {
        jsonError(422, $e->getMessage());
    }

    $processed[] = [
        'data'     => $result['data'],
        'filename' => $i . '.jpg',
        'alt'      => '',        // will be filled from recipe title below
        'width'    => $result['width'],
        'height'   => $result['height'],
    ];
}

// Phase 2: read recipe title for alt text
$recipeRaw = file_get_contents($recipePath);
if ($recipeRaw === false) {
    jsonError(503, 'Failed to read recipe file');
}
$recipe = json_decode($recipeRaw, true);
if (!is_array($recipe)) {
    jsonError(503, 'Recipe file contains invalid JSON');
}
$recipeName = (string)($recipe['title'] ?? $id);

foreach ($processed as &$img) {
    $img['alt'] = $recipeName;
}
unset($img);

// Phase 3: clear old image directory and write new images
$recipeImagesDir = $imagesDir . '/' . $id;

if (is_dir($recipeImagesDir)) {
    // Remove existing images
    $existing = glob($recipeImagesDir . '/*.jpg') ?: [];
    foreach ($existing as $f) {
        @unlink($f);
    }
} else {
    if (!mkdir($recipeImagesDir, 0755, true)) {
        jsonError(503, 'Failed to create images directory');
    }
}

foreach ($processed as $img) {
    $filePath = $recipeImagesDir . '/' . $img['filename'];
    if (file_put_contents($filePath, $img['data']) === false) {
        jsonError(503, "Failed to write image: {$img['filename']}");
    }
}

// Phase 4: build RecipeImage[] for storage
$images = array_map(fn($img) => [
    'filename' => $img['filename'],
    'alt'      => $img['alt'],
    'width'    => $img['width'],
    'height'   => $img['height'],
], $processed);

// Phase 5: update recipe JSON
$recipe['images'] = $images;
try {
    atomicWrite($recipePath, json_encode($recipe, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
} catch (RuntimeException $e) {
    jsonError(503, 'Failed to update recipe: ' . $e->getMessage());
}

// Phase 6: update index
if (is_file($indexPath)) {
    $indexRaw = file_get_contents($indexPath);
    $index    = ($indexRaw !== false) ? json_decode($indexRaw, true) : null;
    if (is_array($index)) {
        foreach ($index as &$entry) {
            if (isset($entry['id']) && $entry['id'] === $id) {
                $entry['images'] = $images;
                break;
            }
        }
        unset($entry);
        try {
            atomicWrite($indexPath, json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        } catch (RuntimeException $e) {
            error_log("set-images: failed to update index for {$id}: " . $e->getMessage());
            // Non-fatal: recipe is updated; index will be stale until next write
        }
    }
}

echo json_encode(['images' => $images]);
