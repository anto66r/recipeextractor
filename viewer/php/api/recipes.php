<?php
/**
 * GET /api/recipes
 * Returns the recipe index as JSON.
 *
 * Data directory resolution:
 *   - Production (Hostinger): __DIR__ is public_html/api/
 *     → ../../data resolves to /data/ (above public_html)
 *   - Local dev: __DIR__ is viewer/php/api/
 *     → set DATA_DIR env var to the absolute path of the data/ directory
 *     e.g. export DATA_DIR=/path/to/recipeextractor/data
 */

header('Content-Type: application/json; charset=utf-8');

$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');

if (!$dataDir) {
    http_response_code(503);
    echo json_encode(['error' => 'Data directory not found']);
    exit;
}

$indexPath = $dataDir . '/recipes/index.json';

if (!is_file($indexPath)) {
    // No recipes yet — return empty array
    echo json_encode([]);
    exit;
}

$raw = file_get_contents($indexPath);
if ($raw === false || $raw === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to read index']);
    exit;
}

// Validate that the file contains valid JSON before passing it through
$decoded = json_decode($raw);
if ($decoded === null) {
    http_response_code(500);
    echo json_encode(['error' => 'Index is corrupt']);
    exit;
}

echo $raw;
