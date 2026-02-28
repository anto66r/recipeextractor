<?php
/**
 * POST /api/add-recipe
 * Body: { url: string }
 *
 * Fetches the page HTML, sends it to the Anthropic API for extraction,
 * and saves the resulting recipe to disk.
 *
 * Returns: { recipeId: string }
 * Errors:  { error: string [, recipeId: string] }
 *
 * HTTP status codes:
 *   200 — success
 *   400 — invalid URL or malformed request
 *   409 — recipe already exists for this URL (recipeId is the existing ID)
 *   500 — extraction or storage failure
 *   503 — ANTHROPIC_API_KEY not configured
 */

header('Content-Type: application/json; charset=utf-8');

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonError(int $status, string $message, array $extra = []): never
{
    http_response_code($status);
    echo json_encode(array_merge(['error' => $message], $extra));
    exit;
}

/** Mirrors cli/src/services/storage.ts::makeSlug */
function makeSlug(string $title): string
{
    $slug = mb_strtolower($title);
    $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug) ?? $slug;
    $slug = trim($slug);
    $slug = preg_replace('/\s+/', '-', $slug) ?? $slug;
    $slug = preg_replace('/-+/', '-', $slug) ?? $slug;
    return trim($slug, '-');
}

/** UUID v4 generator */
function uuidv4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/** Mirrors cli/src/services/extractor.ts::trimHtml */
function trimHtml(string $html): string
{
    $html = preg_replace('/<script\b[^>]*>[\s\S]*?<\/script>/i', '', $html) ?? $html;
    $html = preg_replace('/<style\b[^>]*>[\s\S]*?<\/style>/i', '', $html) ?? $html;
    $html = preg_replace('/<!--[\s\S]*?-->/', '', $html) ?? $html;
    return trim($html);
}

/** Mirrors cli/src/services/extractor.ts::stripFences */
function stripFences(string $raw): string
{
    if (preg_match('/```(?:json)?\s*([\s\S]*?)\s*```/i', $raw, $matches)) {
        return trim($matches[1]);
    }
    return trim($raw);
}

/**
 * Block private/internal IP ranges to prevent SSRF.
 * Called before making outbound HTTP requests.
 */
function assertNotPrivateUrl(string $url): void
{
    $host = parse_url($url, PHP_URL_HOST);
    if ($host === false || $host === null || $host === '') {
        throw new RuntimeException('Invalid URL host.');
    }

    // Resolve hostname to IP for SSRF check
    $ip = gethostbyname($host);
    if ($ip === $host && !filter_var($host, FILTER_VALIDATE_IP)) {
        // Could not resolve — allow (DNS may be slow; let fetch fail naturally)
        return;
    }

    $privateRanges = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8',
        '169.254.0.0/16',  // link-local (AWS metadata: 169.254.169.254)
        '::1/128',
        'fc00::/7',
        'fe80::/10',
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

/** Fetch URL HTML with timeout and User-Agent. */
function fetchHtml(string $url): string
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

    $html = @file_get_contents($url, false, $context);
    if ($html === false || $html === '') {
        throw new RuntimeException('Failed to fetch the page. The URL may be unreachable.');
    }

    // Check HTTP status code from response headers
    if (!empty($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $status = (int)$m[1];
            if ($status >= 400) {
                throw new RuntimeException("Page returned HTTP {$status}. The URL may not be accessible.");
            }
        }
    }

    return $html;
}

/** Call Anthropic Messages API. Returns raw response text from Claude. */
function callClaude(string $html, string $sourceUrl, string $apiKey): string
{
    $MAX_HTML_CHARS = 200000;

    $trimmed = trimHtml($html);
    if (mb_strlen($trimmed) > $MAX_HTML_CHARS) {
        $trimmed = mb_substr($trimmed, 0, $MAX_HTML_CHARS);
    }

    $tagTaxonomy = implode(', ', [
        'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink',
        'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb',
        'Italian', 'Asian', 'Mexican', 'Mediterranean', 'American', 'French',
        'Indian', 'Middle Eastern', 'Japanese', 'Thai',
        'quick', 'meal-prep', 'one-pot', 'batch-cooking', 'comfort-food',
    ]);

    $systemPrompt = 'You are a recipe extraction assistant. Your only task is to extract and normalize '
        . 'recipe data from HTML. You always return valid JSON and nothing else. '
        . 'Do not include markdown code fences, prose, explanations, or apologies. '
        . 'Return only the JSON object.';

    $userMessage = <<<EOT
Extract the recipe from the HTML below and return a single JSON object matching this exact schema:

{
  "title": string,
  "description": string (1-3 sentences about the dish),
  "originalServings": number (the serving count as written on the page),
  "servings": 4,
  "prepTime": string (e.g. "15 minutes"; use "unknown" if not stated),
  "cookTime": string (e.g. "30 minutes"; use "unknown" if not stated),
  "tags": string[] (max 6, chosen only from the taxonomy below),
  "ingredients": [{ "quantity": string, "item": string }],
  "steps": string[]
}

NORMALIZATION RULES:
- Scale all ingredient quantities so the recipe serves exactly 4 people. Set servings to 4.
- Convert all measurements to metric EXCEPT: tsp, tbsp, pinch, dash — keep those as-is.
- Weight: use g (under 1000g) or kg (1000g and above).
- Volume: use ml (under 1000ml) or L (1000ml and above).
- Rewrite each step as a clear, concise sentence in plain English.
- Do not include step numbers in the step strings themselves (they are array entries).
- If prepTime or cookTime is not stated on the page, use "unknown".

TAG TAXONOMY (choose up to 6, use exact strings only):
{$tagTaxonomy}

SOURCE URL: {$sourceUrl}

HTML:
{$trimmed}
EOT;

    $payload = json_encode([
        'model'      => 'claude-haiku-4-5',
        'max_tokens' => 8192,
        'system'     => $systemPrompt,
        'messages'   => [['role' => 'user', 'content' => $userMessage]],
    ]);

    $context = stream_context_create([
        'http' => [
            'method'  => 'POST',
            'header'  => implode("\r\n", [
                'Content-Type: application/json',
                "x-api-key: {$apiKey}",
                'anthropic-version: 2023-06-01',
                'Content-Length: ' . strlen($payload),
            ]),
            'content' => $payload,
            'timeout' => 90,
            'ignore_errors' => true,
        ],
    ]);

    $response = @file_get_contents('https://api.anthropic.com/v1/messages', false, $context);
    if ($response === false) {
        throw new RuntimeException('Claude API request failed (network error).');
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Claude API returned invalid JSON.');
    }

    // Surface API-level errors (e.g. 401 invalid key, 429 rate limit)
    if (isset($decoded['type']) && $decoded['type'] === 'error') {
        $msg = $decoded['error']['message'] ?? 'Unknown API error';
        throw new RuntimeException("Claude API error: {$msg}");
    }

    $text = $decoded['content'][0]['text'] ?? null;
    if (!is_string($text) || $text === '') {
        throw new RuntimeException('Claude returned an unexpected response format.');
    }

    return $text;
}

/** Parse and validate the raw Claude response into a recipe array. */
function parseRecipeResponse(string $raw): array
{
    $cleaned = stripFences($raw);
    $data = json_decode($cleaned, true);
    if (!is_array($data)) {
        throw new RuntimeException('Claude returned invalid JSON: ' . substr($cleaned, 0, 200));
    }

    $required = ['title', 'description', 'originalServings', 'servings',
                 'prepTime', 'cookTime', 'tags', 'ingredients', 'steps'];
    foreach ($required as $field) {
        if (!array_key_exists($field, $data)) {
            throw new RuntimeException("Missing required field: {$field}");
        }
    }

    if (!is_string($data['title']) || trim($data['title']) === '') {
        throw new RuntimeException('title must be a non-empty string');
    }
    if (!is_string($data['description']) || trim($data['description']) === '') {
        throw new RuntimeException('description must be a non-empty string');
    }
    if ((!is_int($data['originalServings']) && !is_float($data['originalServings'])) || (int)$data['originalServings'] < 1) {
        throw new RuntimeException('originalServings must be a positive integer');
    }
    if (!is_string($data['prepTime']) || trim($data['prepTime']) === '') {
        throw new RuntimeException('prepTime must be a non-empty string');
    }
    if (!is_string($data['cookTime']) || trim($data['cookTime']) === '') {
        throw new RuntimeException('cookTime must be a non-empty string');
    }
    if ((int)$data['servings'] !== 4) {
        throw new RuntimeException('servings must be 4');
    }
    if (!is_array($data['tags'])) {
        throw new RuntimeException('tags must be an array');
    }
    $allowedTags = [
        'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'drink',
        'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb',
        'Italian', 'Asian', 'Mexican', 'Mediterranean', 'American', 'French',
        'Indian', 'Middle Eastern', 'Japanese', 'Thai',
        'quick', 'meal-prep', 'one-pot', 'batch-cooking', 'comfort-food',
    ];
    foreach ($data['tags'] as $tag) {
        if (!in_array($tag, $allowedTags, true)) {
            throw new RuntimeException("Invalid tag: {$tag}");
        }
    }
    if (!is_array($data['ingredients']) || count($data['ingredients']) === 0) {
        throw new RuntimeException('ingredients must be a non-empty array');
    }
    if (!is_array($data['steps']) || count($data['steps']) === 0) {
        throw new RuntimeException('steps must be a non-empty array');
    }

    // Validate each ingredient has quantity + item
    foreach ($data['ingredients'] as $ing) {
        if (!isset($ing['quantity'], $ing['item'])) {
            throw new RuntimeException('Each ingredient must have quantity and item');
        }
    }

    return $data;
}

/**
 * Read index.json. Returns [] if not found.
 * @return array<int, array<string, mixed>>
 */
function readIndex(string $indexPath): array
{
    if (!is_file($indexPath)) {
        return [];
    }
    $raw = file_get_contents($indexPath);
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/** Atomic write of a file via a temp file + rename. */
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

// Catch-all: converts uncaught PHP Errors/Exceptions to a visible 503 response
// instead of letting LiteSpeed swallow them as an empty-body HTTP 500.
set_exception_handler(function (Throwable $e) {
    error_log('add-recipe uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(503);
    echo json_encode(['error' => 'Unexpected server error: ' . $e->getMessage()]);
    exit;
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError(405, 'Method not allowed');
}

// Parse JSON body
$body = (string)file_get_contents('php://input');
$input = json_decode($body, true);
if (!is_array($input)) {
    jsonError(400, 'Request body must be a JSON object');
}

$url = trim($input['url'] ?? '');
if ($url === '') {
    jsonError(400, 'Missing required field: url');
}

// Validate URL scheme
$parsed = parse_url($url);
if (!$parsed || !isset($parsed['scheme'], $parsed['host'])) {
    jsonError(400, 'Invalid URL');
}
if (!in_array($parsed['scheme'], ['http', 'https'], true)) {
    jsonError(400, 'URL must use http or https');
}

// Check API key early
$apiKey = getenv('ANTHROPIC_API_KEY') ?: '';
if ($apiKey === '') {
    jsonError(503, 'ANTHROPIC_API_KEY is not configured on the server');
}

// Resolve data directory
$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');
if (!$dataDir) {
    jsonError(503, 'Data directory not found');
}

$recipesDir = $dataDir . '/recipes';
$indexPath  = $recipesDir . '/index.json';

// Check for duplicate URL
$index = readIndex($indexPath);
foreach ($index as $entry) {
    if (isset($entry['sourceUrl']) && $entry['sourceUrl'] === $url) {
        jsonError(409, 'Recipe already exists for this URL', ['recipeId' => $entry['id']]);
    }
}

// Fetch page HTML
try {
    $html = fetchHtml($url);
} catch (RuntimeException $e) {
    jsonError(422, $e->getMessage());
}

// Extract via Claude (retry once on failure, mirrors CLI behavior)
$extracted = null;
$lastError  = '';

for ($attempt = 1; $attempt <= 2; $attempt++) {
    try {
        $raw       = callClaude($html, $url, $apiKey);
        $extracted = parseRecipeResponse($raw);
        break;
    } catch (RuntimeException $e) {
        $lastError = $e->getMessage();
        // retry on first attempt
    }
}

if ($extracted === null) {
    jsonError(422, "Failed to extract recipe after 2 attempts. Last error: {$lastError}");
}

// Save recipe
$id        = uuidv4();
$slug      = makeSlug($extracted['title']);
$createdAt = gmdate('Y-m-d\TH:i:s.') . str_pad((int)(microtime(true) * 1000) % 1000, 3, '0', STR_PAD_LEFT) . 'Z';

$recipe = [
    'schemaVersion'   => 2,
    'id'              => $id,
    'slug'            => $slug,
    'title'           => $extracted['title'],
    'description'     => $extracted['description'],
    'sourceUrl'       => $url,
    'originalServings'=> (int)$extracted['originalServings'],
    'servings'        => 4,
    'prepTime'        => $extracted['prepTime'],
    'cookTime'        => $extracted['cookTime'],
    'tags'            => $extracted['tags'],
    'images'          => [],
    'ingredients'     => $extracted['ingredients'],
    'steps'           => $extracted['steps'],
    'createdAt'       => $createdAt,
];

// Ensure recipes directory exists
if (!is_dir($recipesDir) && !mkdir($recipesDir, 0755, true)) {
    jsonError(503, 'Failed to create recipes directory');
}

// Write recipe file
try {
    atomicWrite($recipesDir . '/' . $id . '.json', json_encode($recipe, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
} catch (RuntimeException $e) {
    jsonError(503, 'Failed to save recipe: ' . $e->getMessage());
}

// Update index
$indexEntry = [
    'id'        => $id,
    'slug'      => $slug,
    'title'     => $recipe['title'],
    'tags'      => $recipe['tags'],
    'images'    => [],
    'sourceUrl' => $url,
    'createdAt' => $createdAt,
];
$index[] = $indexEntry;

try {
    atomicWrite($indexPath, json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
} catch (RuntimeException $e) {
    // Recipe file written but index update failed — log and still return success
    // (data integrity note: recipe exists but won't appear in list until index is repaired)
    error_log("FR-13 add-recipe: failed to update index for {$id}: " . $e->getMessage());
}

echo json_encode(['recipeId' => $id]);
