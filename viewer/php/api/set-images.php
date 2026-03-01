<?php
/**
 * POST /api/set-images
 *
 * New format (from viewer ImageCarousel):
 *   { id: string, images: Array<
 *       { type: 'existing', filename: string } |
 *       { type: 'url',      url: string } |
 *       { type: 'base64',   data: string }
 *   > }
 *
 * Legacy format (from CLI / backward compat):
 *   { id: string, urls: string[] }
 *
 * Downloads/decodes each image, converts to JPEG (max 1200px, q85) using GD,
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

// ── Normalise input into $specs ───────────────────────────────────────────────
// New format: { images: [{type, ...}] }
// Legacy format: { urls: string[] }  (CLI backward compat)

if (isset($input['images']) && is_array($input['images'])) {
    $specs = $input['images'];
    if (count($specs) === 0) {
        jsonError(400, 'images must be a non-empty array');
    }
    foreach ($specs as $i => $spec) {
        if (!is_array($spec) || !isset($spec['type'])) {
            jsonError(400, "images[{$i}] must be an object with a type field");
        }
        $type = $spec['type'];
        if ($type === 'existing') {
            if (empty($spec['filename']) || !is_string($spec['filename'])) {
                jsonError(400, "images[{$i}]: existing spec requires a filename string");
            }
            if (!preg_match('/^\d+\.jpg$/', $spec['filename'])) {
                jsonError(400, "images[{$i}]: invalid filename '{$spec['filename']}'");
            }
        } elseif ($type === 'url') {
            $url = $spec['url'] ?? '';
            if (!is_string($url) || trim($url) === '') {
                jsonError(400, "images[{$i}]: url spec requires a url string");
            }
            $parsed = parse_url($url);
            if (!$parsed || !in_array($parsed['scheme'] ?? '', ['http', 'https'], true)) {
                jsonError(400, "images[{$i}]: URL must use http or https");
            }
        } elseif ($type === 'base64') {
            if (empty($spec['data']) || !is_string($spec['data'])) {
                jsonError(400, "images[{$i}]: base64 spec requires a data string");
            }
        } else {
            jsonError(400, "images[{$i}]: unknown type '{$type}'");
        }
    }
} elseif (isset($input['urls']) && is_array($input['urls'])) {
    // Legacy: convert urls[] → specs[]
    if (count($input['urls']) === 0) {
        jsonError(400, 'urls must be a non-empty array');
    }
    $specs = [];
    foreach ($input['urls'] as $i => $url) {
        if (!is_string($url) || trim($url) === '') {
            jsonError(400, 'Each URL must be a non-empty string');
        }
        $parsed = parse_url($url);
        if (!$parsed || !in_array($parsed['scheme'] ?? '', ['http', 'https'], true)) {
            jsonError(400, "URL must use http or https: {$url}");
        }
        $specs[] = ['type' => 'url', 'url' => $url];
    }
} else {
    jsonError(400, 'Request must include either an images or urls array');
}

// ── Resolve paths ─────────────────────────────────────────────────────────────

$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');
if (!$dataDir) {
    jsonError(503, 'Data directory not found');
}

$recipesDir      = $dataDir . '/recipes';
$imagesDir       = $dataDir . '/images';
$recipePath      = $recipesDir . '/' . $id . '.json';
$indexPath       = $recipesDir . '/index.json';
$recipeImagesDir = $imagesDir . '/' . $id;

// Verify recipe exists
if (!is_file($recipePath)) {
    jsonError(404, 'Recipe not found');
}

// Read recipe now (needed for alt text and for resolving 'existing' metadata)
$recipeRaw = file_get_contents($recipePath);
if ($recipeRaw === false) {
    jsonError(503, 'Failed to read recipe file');
}
$recipe = json_decode($recipeRaw, true);
if (!is_array($recipe)) {
    jsonError(503, 'Recipe file contains invalid JSON');
}
$recipeName = (string)($recipe['title'] ?? $id);

// Build a lookup of current images by filename for 'existing' specs
$currentImages = [];
if (!empty($recipe['images']) && is_array($recipe['images'])) {
    foreach ($recipe['images'] as $img) {
        if (isset($img['filename'])) {
            $currentImages[$img['filename']] = $img;
        }
    }
}

// ── Phase 1: process all specs to memory — no disk writes yet ─────────────────

$processed = [];
foreach ($specs as $i => $spec) {
    $type = $spec['type'];

    try {
        if ($type === 'existing') {
            $filename = $spec['filename'];
            $filePath = $recipeImagesDir . '/' . $filename;
            if (!is_file($filePath)) {
                throw new RuntimeException("Existing image not found on disk: {$filename}");
            }
            $bytes = file_get_contents($filePath);
            if ($bytes === false) {
                throw new RuntimeException("Failed to read existing image: {$filename}");
            }
            // Preserve metadata from current recipe; fall back to re-decoding dimensions
            $meta = $currentImages[$filename] ?? null;
            if ($meta && isset($meta['width'], $meta['height'])) {
                $width  = (int)$meta['width'];
                $height = (int)$meta['height'];
            } else {
                // Decode to get dimensions (rare fallback)
                $result = processImageToJpeg($bytes);
                $bytes  = $result['data'];
                $width  = $result['width'];
                $height = $result['height'];
            }
            $processed[] = [
                'data'     => $bytes,
                'filename' => $i . '.jpg',
                'alt'      => $recipeName,
                'width'    => $width,
                'height'   => $height,
            ];
        } elseif ($type === 'url') {
            $bytes  = fetchImageBytes($spec['url']);
            $result = processImageToJpeg($bytes);
            $processed[] = [
                'data'     => $result['data'],
                'filename' => $i . '.jpg',
                'alt'      => $recipeName,
                'width'    => $result['width'],
                'height'   => $result['height'],
            ];
        } elseif ($type === 'base64') {
            $bytes = base64_decode($spec['data'], true);
            if ($bytes === false || $bytes === '') {
                throw new RuntimeException('Invalid base64 image data.');
            }
            $result = processImageToJpeg($bytes);
            $processed[] = [
                'data'     => $result['data'],
                'filename' => $i . '.jpg',
                'alt'      => $recipeName,
                'width'    => $result['width'],
                'height'   => $result['height'],
            ];
        }
    } catch (RuntimeException $e) {
        jsonError(422, $e->getMessage());
    }
}

// ── Phase 2: clear old image directory and write new images ───────────────────

if (is_dir($recipeImagesDir)) {
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

// ── Phase 3: build RecipeImage[] for storage ──────────────────────────────────

$images = array_map(fn($img) => [
    'filename' => $img['filename'],
    'alt'      => $img['alt'],
    'width'    => $img['width'],
    'height'   => $img['height'],
], $processed);

// ── Phase 4: update recipe JSON ───────────────────────────────────────────────

$recipe['images'] = $images;
try {
    atomicWrite($recipePath, json_encode($recipe, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
} catch (RuntimeException $e) {
    jsonError(503, 'Failed to update recipe: ' . $e->getMessage());
}

// ── Phase 5: update index ─────────────────────────────────────────────────────

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
