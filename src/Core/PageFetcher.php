<?php
declare(strict_types=1);

/**
 * PageFetcher
 *
 * Handles HTTP requests to fetch web pages using cURL with fallback to file_get_contents.
 * Includes retry logic and proper error handling.
 */
class PageFetcher
{
    /**
     * Fetches HTML content from a URL
     *
     * @param string $url The URL to fetch
     * @return array Result array with 'success', 'html', and 'error' keys
     */
    public static function fetch(string $url): array
    {
        $attempt = 0;
        $maxAttempts = MAX_RETRIES + 1; // Initial attempt + retries

        while ($attempt < $maxAttempts) {
            $attempt++;

            // Try cURL first if available
            if (function_exists('curl_init')) {
                $result = self::fetchWithCurl($url);
            } else {
                // Fallback to file_get_contents
                $result = self::fetchWithFileGetContents($url);
            }

            // If successful, return immediately
            if ($result['success']) {
                Logger::info("Successfully fetched URL on attempt {$attempt}", ['url' => $url]);
                return $result;
            }

            // Log the failure
            Logger::warning("Failed to fetch URL on attempt {$attempt}", [
                'url' => $url,
                'error' => $result['error']
            ]);

            // If this is a permanent error (4xx), don't retry
            if (isset($result['httpCode']) && $result['httpCode'] >= 400 && $result['httpCode'] < 500) {
                break;
            }

            // Wait before retry (exponential backoff)
            if ($attempt < $maxAttempts) {
                usleep(500000 * $attempt); // 0.5s, 1s delay
            }
        }

        return [
            'success' => false,
            'html' => null,
            'error' => $result['error'] ?? 'Failed to fetch page after multiple attempts'
        ];
    }

    /**
     * Fetches content using cURL
     *
     * @param string $url The URL to fetch
     * @return array Result array
     */
    private static function fetchWithCurl(string $url): array
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => MAX_REDIRECTS,
            CURLOPT_TIMEOUT => FETCH_TIMEOUT,
            CURLOPT_USERAGENT => USER_AGENT,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_ENCODING => '', // Accept any encoding
            CURLOPT_HTTPHEADER => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.9',
                'Cache-Control: no-cache',
            ]
        ]);

        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        if ($html === false) {
            return [
                'success' => false,
                'html' => null,
                'error' => "cURL error: {$error}",
                'httpCode' => $httpCode
            ];
        }

        if ($httpCode >= 400) {
            return [
                'success' => false,
                'html' => null,
                'error' => "HTTP error: {$httpCode}",
                'httpCode' => $httpCode
            ];
        }

        return [
            'success' => true,
            'html' => $html,
            'error' => null,
            'httpCode' => $httpCode
        ];
    }

    /**
     * Fetches content using file_get_contents (fallback)
     *
     * @param string $url The URL to fetch
     * @return array Result array
     */
    private static function fetchWithFileGetContents(string $url): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'User-Agent: ' . USER_AGENT,
                    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language: en-US,en;q=0.9',
                ]),
                'timeout' => FETCH_TIMEOUT,
                'follow_location' => 1,
                'max_redirects' => MAX_REDIRECTS,
                'ignore_errors' => true // Get content even on 4xx/5xx
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ]
        ]);

        $html = @file_get_contents($url, false, $context);

        if ($html === false) {
            $error = error_get_last();
            return [
                'success' => false,
                'html' => null,
                'error' => "file_get_contents error: " . ($error['message'] ?? 'Unknown error')
            ];
        }

        // Parse HTTP response code from headers
        $httpCode = 200;
        if (isset($http_response_header[0])) {
            preg_match('/HTTP\/\d\.\d\s+(\d+)/', $http_response_header[0], $matches);
            $httpCode = isset($matches[1]) ? (int)$matches[1] : 200;
        }

        if ($httpCode >= 400) {
            return [
                'success' => false,
                'html' => null,
                'error' => "HTTP error: {$httpCode}",
                'httpCode' => $httpCode
            ];
        }

        return [
            'success' => true,
            'html' => $html,
            'error' => null,
            'httpCode' => $httpCode
        ];
    }
}
