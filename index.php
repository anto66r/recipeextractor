<?php
declare(strict_types=1);

/**
 * Recipe Extractor - Main Entry Point
 *
 * Handles all HTTP requests and routes them to appropriate handlers.
 */

// Load configuration and autoloader
require_once __DIR__ . '/config.php';

// Error handling - log errors but don't display them to users
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Custom error handler
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    Logger::error("PHP Error: {$errstr}", [
        'errno' => $errno,
        'file' => $errfile,
        'line' => $errline
    ]);
    return true; // Don't execute PHP's internal error handler
});

// Custom exception handler
set_exception_handler(function (Throwable $e) {
    Logger::error("Uncaught exception: {$e->getMessage()}", [
        'exception' => get_class($e),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);

    // Show user-friendly error page
    $errorMessage = 'An unexpected error occurred. Please try again later.';
    include APP_ROOT . '/src/Views/error.php';
    exit;
});

// Initialize recipe index if it doesn't exist
if (!file_exists(INDEX_PATH)) {
    $emptyIndex = [
        'recipes' => [],
        'lastUpdated' => null,
        'totalRecipes' => 0
    ];

    $indexDir = dirname(INDEX_PATH);
    if (!is_dir($indexDir)) {
        mkdir($indexDir, 0755, true);
    }

    file_put_contents(
        INDEX_PATH,
        json_encode($emptyIndex, JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

// Route request
if (Router::isGet()) {
    // Show submission form
    include APP_ROOT . '/src/Views/form.php';
    exit;
}

if (Router::isPost()) {
    try {
        // Get URL from POST data
        $url = trim(Router::post('url', ''));

        // Validate URL
        if (Validator::isEmpty($url)) {
            throw new Exception('Please provide a URL');
        }

        if (!Validator::isValidUrl($url)) {
            throw new Exception('Invalid URL format. Please provide a valid HTTP or HTTPS URL.');
        }

        Logger::info('Processing recipe extraction request', ['url' => $url]);

        // Fetch page
        $fetchResult = PageFetcher::fetch($url);

        if (!$fetchResult['success']) {
            throw new Exception('Failed to fetch the page: ' . ($fetchResult['error'] ?? 'Unknown error'));
        }

        $html = $fetchResult['html'];

        if (empty($html)) {
            throw new Exception('The fetched page is empty');
        }

        // Extract recipe data
        $extractor = new RecipeExtractor();
        $recipeData = $extractor->extract($html);

        // Check if extraction was successful
        if (empty($recipeData['ingredients']) && empty($recipeData['steps'])) {
            throw new Exception('No recipe data could be found on this page. Please ensure the URL points to a recipe page with structured data.');
        }

        // Generate UUID for this recipe
        $recipeId = UUID::v4();

        // Build complete recipe object
        $recipe = [
            'id' => $recipeId,
            'url' => $url,
            'title' => $recipeData['title'],
            'extractedAt' => date('c'),
            'servings' => $recipeData['servings'],
            'image' => $recipeData['image'],
            'tags' => [
                'manual' => [],
                'auto' => [],
                'rejected' => []
            ],
            'ingredients' => $recipeData['ingredients'],
            'steps' => $recipeData['steps'],
            'metadata' => array_merge($recipeData['metadata'], [
                'lastModified' => date('c')
            ])
        ];

        // Save recipe to storage
        $storage = new StorageManager();
        $saved = $storage->save($recipeId, $recipe);

        if (!$saved) {
            throw new Exception('Failed to save recipe data. Please try again.');
        }

        Logger::info('Recipe extraction completed successfully', [
            'id' => $recipeId,
            'url' => $url,
            'title' => $recipe['title'] ?? 'Untitled'
        ]);

        // Show success page
        include APP_ROOT . '/src/Views/result.php';
        exit;

    } catch (Exception $e) {
        // Log the error
        Logger::error('Recipe extraction failed', [
            'url' => $url ?? 'unknown',
            'error' => $e->getMessage()
        ]);

        // Show error page
        $errorMessage = $e->getMessage();
        include APP_ROOT . '/src/Views/error.php';
        exit;
    }
}

// Method not allowed
http_response_code(405);
echo 'Method Not Allowed';
exit;
