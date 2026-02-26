<?php
declare(strict_types=1);

/**
 * Router
 *
 * Simple router for handling GET and POST requests.
 * No framework dependencies - just basic request dispatch.
 */
class Router
{
    /**
     * Gets the request method
     *
     * @return string The HTTP request method (GET, POST, etc.)
     */
    public static function getMethod(): string
    {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }

    /**
     * Checks if the request is a GET request
     *
     * @return bool True if GET request, false otherwise
     */
    public static function isGet(): bool
    {
        return self::getMethod() === 'GET';
    }

    /**
     * Checks if the request is a POST request
     *
     * @return bool True if POST request, false otherwise
     */
    public static function isPost(): bool
    {
        return self::getMethod() === 'POST';
    }

    /**
     * Gets a POST parameter value
     *
     * @param string $key The parameter key
     * @param mixed $default Default value if parameter doesn't exist
     * @return mixed The parameter value or default
     */
    public static function post(string $key, $default = null)
    {
        return $_POST[$key] ?? $default;
    }

    /**
     * Gets a GET parameter value
     *
     * @param string $key The parameter key
     * @param mixed $default Default value if parameter doesn't exist
     * @return mixed The parameter value or default
     */
    public static function get(string $key, $default = null)
    {
        return $_GET[$key] ?? $default;
    }

    /**
     * Redirects to a URL
     *
     * @param string $url The URL to redirect to
     * @return void
     */
    public static function redirect(string $url): void
    {
        header("Location: {$url}");
        exit;
    }

    /**
     * Returns JSON response
     *
     * @param array $data The data to encode as JSON
     * @param int $statusCode HTTP status code
     * @return void
     */
    public static function json(array $data, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
