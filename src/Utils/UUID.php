<?php
declare(strict_types=1);

/**
 * UUID
 *
 * Generates UUID v4 identifiers.
 */
class UUID
{
    /**
     * Generates a UUID v4 (random)
     *
     * @return string A UUID v4 string
     */
    public static function v4(): string
    {
        // Generate 16 bytes of random data
        $data = random_bytes(16);

        // Set version to 0100 (UUID v4)
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);

        // Set variant to 10xx
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

        // Format as UUID string
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
