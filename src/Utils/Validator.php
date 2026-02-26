<?php
declare(strict_types=1);

/**
 * Validator
 *
 * Provides validation utilities for input data.
 */
class Validator
{
    /**
     * Validates a URL format and scheme
     *
     * Ensures the URL is valid HTTP/HTTPS and prevents SSRF attacks
     * by blocking file://, ftp://, and other non-HTTP schemes.
     *
     * @param string $url The URL to validate
     * @return bool True if valid, false otherwise
     */
    public static function isValidUrl(string $url): bool
    {
        // Filter URL using PHP's built-in filter
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        // Parse URL to check scheme
        $parsed = parse_url($url);

        if (!isset($parsed['scheme']) || !isset($parsed['host'])) {
            return false;
        }

        // Only allow HTTP and HTTPS schemes to prevent SSRF
        $allowedSchemes = ['http', 'https'];
        if (!in_array(strtolower($parsed['scheme']), $allowedSchemes, true)) {
            return false;
        }

        return true;
    }

    /**
     * Sanitizes a string for safe output
     *
     * @param string $input The string to sanitize
     * @return string The sanitized string
     */
    public static function sanitize(string $input): string
    {
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Checks if a string is empty or contains only whitespace
     *
     * @param string $input The string to check
     * @return bool True if empty, false otherwise
     */
    public static function isEmpty(string $input): bool
    {
        return trim($input) === '';
    }
}
