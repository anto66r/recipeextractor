<?php
/**
 * GET /api/recipe?id=<uuid>
 * Returns a single recipe JSON file.
 */

header('Content-Type: application/json; charset=utf-8');

$id = $_GET['id'] ?? '';

// Validate UUID v4 format to prevent path traversal
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid recipe id']);
    exit;
}

$dataDir = getenv('DATA_DIR') ?: realpath(__DIR__ . '/../../data');

if (!$dataDir) {
    http_response_code(503);
    echo json_encode(['error' => 'Data directory not found']);
    exit;
}

$filePath = $dataDir . '/recipes/' . $id . '.json';

if (!is_file($filePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Recipe not found']);
    exit;
}

$raw = file_get_contents($filePath);
if ($raw === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to read recipe']);
    exit;
}

echo $raw;
