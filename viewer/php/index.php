<?php
/**
 * SPA routing fallback.
 * - API routes are handled by api/*.php directly.
 * - All other GET requests serve the Vite-built index.html.
 *
 * On Hostinger, configure .htaccess or PHP handler to route all
 * non-file requests here.
 *
 * Local dev: php -S localhost:8080 -t viewer/php viewer/php/router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Let the built-in PHP server serve real files (CSS/JS assets)
if (php_sapi_name() === 'cli-server' && is_file(__DIR__ . $uri)) {
    return false;
}

// Route API requests to the correct handler (explicit allowlist to prevent path traversal)
$allowedEndpoints = ['recipes', 'recipe', 'image'];

if (str_starts_with($uri, '/api/')) {
    $segment = substr($uri, strlen('/api/'));
    // Strip any trailing slashes or query strings (parse_url already stripped query)
    $segment = rtrim($segment, '/');

    if (!in_array($segment, $allowedEndpoints, true)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Not found']);
        exit;
    }

    require __DIR__ . '/api/' . $segment . '.php';
    exit;
}

// Serve the Vite-built SPA shell for all other routes
$indexPath = __DIR__ . '/../dist/index.html';
if (!is_file($indexPath)) {
    http_response_code(503);
    echo 'Viewer not built. Run: npm run build inside viewer/';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
readfile($indexPath);
