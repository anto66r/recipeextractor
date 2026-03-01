<?php
/**
 * GET /api/image?id=<recipe-uuid>&f=<image-filename.jpg>
 * Streams a recipe image (JPEG) from the data directory.
 * Validates both parameters before constructing any file path.
 *
 * The filename is the UUID-based filename stored in the recipe JSON,
 * which changes with every upload — providing natural cache busting.
 */

header('Content-Type: text/plain; charset=utf-8');

$id = $_GET['id'] ?? '';
$f  = $_GET['f']  ?? '';

// Validate recipe UUID v4
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) {
    http_response_code(400);
    echo 'Invalid id';
    exit;
}

// Validate image filename: UUID.jpg or legacy positional (0.jpg, 1.jpg)
// No path separators or dots in the basename allowed.
if (!preg_match('/^[0-9a-f-]+\.jpg$/i', $f) || str_contains($f, '..') || str_contains($f, '/')) {
    http_response_code(400);
    echo 'Invalid f (must be a .jpg filename)';
    exit;
}

$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');

if (!$dataDir) {
    http_response_code(503);
    echo 'Data directory not found';
    exit;
}

$filePath = $dataDir . '/images/' . $id . '/' . $f;

if (!is_file($filePath)) {
    http_response_code(404);
    echo 'Image not found';
    exit;
}

// Override Content-Type now that we know we have a valid image file
header('Content-Type: image/jpeg');
header('Cache-Control: public, max-age=31536000, immutable');
// Omit Content-Length to avoid a race between filesize() and readfile()
readfile($filePath);
