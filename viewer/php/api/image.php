<?php
/**
 * GET /api/image?id=<uuid>&n=<positive integer>
 * Streams a recipe image (JPEG) from the data directory.
 * Validates both parameters before constructing any file path.
 */

header('Content-Type: text/plain; charset=utf-8');

$id = $_GET['id'] ?? '';
$n  = $_GET['n']  ?? '';

// Validate UUID v4
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) {
    http_response_code(400);
    echo 'Invalid id';
    exit;
}

// Validate image index (positive integer)
if (!preg_match('/^[1-9][0-9]*$/', $n)) {
    http_response_code(400);
    echo 'Invalid n (must be a positive integer)';
    exit;
}

$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');

if (!$dataDir) {
    http_response_code(503);
    echo 'Data directory not found';
    exit;
}

$filePath = $dataDir . '/images/' . $id . '/' . $n . '.jpg';

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
