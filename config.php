<?php
declare(strict_types=1);

/**
 * Application Configuration
 *
 * Contains all application constants and PSR-4-style autoloader
 * for the Recipe Extractor application.
 */

// Application root directory
define('APP_ROOT', __DIR__);

// Storage paths
define('STORAGE_PATH', APP_ROOT . '/recipes/data');
define('INDEX_PATH', APP_ROOT . '/recipes/index.json');
define('LOG_PATH', APP_ROOT . '/logs/error.log');
define('CONFIG_PATH', APP_ROOT . '/config');

// HTTP fetch configuration
define('FETCH_TIMEOUT', 15);
define('MAX_REDIRECTS', 3);
define('MAX_RETRIES', 2);
define('USER_AGENT', 'RecipeExtractor/1.0 (Personal Use)');

// PSR-4-style autoloader
spl_autoload_register(function ($class) {
    // Base namespace (empty for this project)
    $prefix = '';

    // Base directory for the namespace prefix
    $base_dir = APP_ROOT . '/src/';

    // Does the class use the namespace prefix?
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        // No, move to the next registered autoloader
        // For this project, all classes are in src/ without namespace
        // So we just replace backslashes with forward slashes
    }

    // Get the relative class name
    $relative_class = substr($class, $len);

    // Replace namespace separators with directory separators
    // and append .php
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    // If the file exists, require it
    if (file_exists($file)) {
        require $file;
    }
});
