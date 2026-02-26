<?php
declare(strict_types=1);

/**
 * Logger
 *
 * Provides file-based error logging with timestamps and context.
 */
class Logger
{
    /**
     * Logs an error message to the error log file
     *
     * @param string $message The error message
     * @param array $context Additional context data
     * @return bool True if logged successfully, false otherwise
     */
    public static function error(string $message, array $context = []): bool
    {
        return self::log('ERROR', $message, $context);
    }

    /**
     * Logs an info message to the error log file
     *
     * @param string $message The info message
     * @param array $context Additional context data
     * @return bool True if logged successfully, false otherwise
     */
    public static function info(string $message, array $context = []): bool
    {
        return self::log('INFO', $message, $context);
    }

    /**
     * Logs a warning message to the error log file
     *
     * @param string $message The warning message
     * @param array $context Additional context data
     * @return bool True if logged successfully, false otherwise
     */
    public static function warning(string $message, array $context = []): bool
    {
        return self::log('WARNING', $message, $context);
    }

    /**
     * Internal logging method
     *
     * @param string $level The log level (ERROR, INFO, WARNING)
     * @param string $message The log message
     * @param array $context Additional context data
     * @return bool True if logged successfully, false otherwise
     */
    private static function log(string $level, string $message, array $context = []): bool
    {
        $timestamp = date('Y-m-d H:i:s');
        $contextString = !empty($context) ? ' | Context: ' . json_encode($context) : '';
        $logEntry = "[{$timestamp}] [{$level}] {$message}{$contextString}\n";

        // Ensure log directory exists and is writable
        $logDir = dirname(LOG_PATH);
        if (!is_dir($logDir) && !mkdir($logDir, 0755, true) && !is_dir($logDir)) {
            return false;
        }

        // Append to log file
        return file_put_contents(LOG_PATH, $logEntry, FILE_APPEND | LOCK_EX) !== false;
    }
}
