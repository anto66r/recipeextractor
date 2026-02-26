<?php
declare(strict_types=1);

/**
 * StorageManager
 *
 * Manages persistent storage of recipe data using flat-file JSON.
 * Uses atomic writes and file locking for data integrity.
 */
class StorageManager
{
    /**
     * Saves a recipe to disk
     *
     * @param string $id The recipe ID (UUID)
     * @param array $data The recipe data to save
     * @return bool True if saved successfully, false otherwise
     */
    public function save(string $id, array $data): bool
    {
        try {
            // Ensure storage directory exists
            if (!$this->ensureStorageDirectory()) {
                Logger::error('Failed to create storage directory', ['path' => STORAGE_PATH]);
                return false;
            }

            // Build file path
            $filePath = STORAGE_PATH . '/' . $id . '.json';

            // Write to temporary file first (atomic write)
            $tempPath = $filePath . '.tmp';
            $jsonData = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($jsonData === false) {
                Logger::error('Failed to encode recipe data as JSON', ['id' => $id]);
                return false;
            }

            // Write to temp file with exclusive lock
            $result = file_put_contents($tempPath, $jsonData, LOCK_EX);

            if ($result === false) {
                Logger::error('Failed to write recipe to temp file', ['id' => $id, 'path' => $tempPath]);
                return false;
            }

            // Atomic rename
            if (!rename($tempPath, $filePath)) {
                Logger::error('Failed to rename temp file to final destination', [
                    'id' => $id,
                    'from' => $tempPath,
                    'to' => $filePath
                ]);
                @unlink($tempPath); // Clean up temp file
                return false;
            }

            Logger::info('Recipe saved successfully', ['id' => $id, 'path' => $filePath]);

            // Update index
            $this->updateIndex($id, $data);

            return true;

        } catch (Exception $e) {
            Logger::error('Exception while saving recipe', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Updates the recipe index with new recipe metadata
     *
     * @param string $id The recipe ID
     * @param array $data The recipe data
     * @return bool True if updated successfully, false otherwise
     */
    public function updateIndex(string $id, array $data): bool
    {
        try {
            // Load existing index
            $index = $this->loadIndex();

            // Build metadata entry
            $metadata = [
                'id' => $id,
                'title' => $data['title'] ?? 'Untitled Recipe',
                'url' => $data['url'] ?? null,
                'extractedAt' => $data['extractedAt'] ?? null,
                'ingredientCount' => count($data['ingredients'] ?? []),
                'stepCount' => count($data['steps'] ?? []),
                'extractionMethod' => $data['metadata']['extractionMethod'] ?? 'unknown',
                'confidence' => $data['metadata']['confidence'] ?? 'low'
            ];

            // Check if recipe already exists in index
            $existingIndex = -1;
            foreach ($index['recipes'] as $i => $recipe) {
                if ($recipe['id'] === $id) {
                    $existingIndex = $i;
                    break;
                }
            }

            // Update or add recipe
            if ($existingIndex >= 0) {
                $index['recipes'][$existingIndex] = $metadata;
            } else {
                $index['recipes'][] = $metadata;
            }

            // Update index metadata
            $index['totalRecipes'] = count($index['recipes']);
            $index['lastUpdated'] = date('c');

            // Save index
            return $this->saveIndex($index);

        } catch (Exception $e) {
            Logger::error('Exception while updating index', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Loads the recipe index
     *
     * @return array The index data
     */
    private function loadIndex(): array
    {
        if (!file_exists(INDEX_PATH)) {
            return $this->getEmptyIndex();
        }

        $jsonData = file_get_contents(INDEX_PATH);

        if ($jsonData === false) {
            Logger::warning('Failed to read index file', ['path' => INDEX_PATH]);
            return $this->getEmptyIndex();
        }

        $index = json_decode($jsonData, true);

        if ($index === null) {
            Logger::warning('Failed to decode index JSON', ['path' => INDEX_PATH]);
            return $this->getEmptyIndex();
        }

        return $index;
    }

    /**
     * Saves the recipe index
     *
     * @param array $index The index data
     * @return bool True if saved successfully, false otherwise
     */
    private function saveIndex(array $index): bool
    {
        $jsonData = json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($jsonData === false) {
            Logger::error('Failed to encode index as JSON');
            return false;
        }

        // Ensure parent directory exists
        $indexDir = dirname(INDEX_PATH);
        if (!is_dir($indexDir) && !mkdir($indexDir, 0755, true) && !is_dir($indexDir)) {
            Logger::error('Failed to create index directory', ['path' => $indexDir]);
            return false;
        }

        // Atomic write
        $tempPath = INDEX_PATH . '.tmp';
        $result = file_put_contents($tempPath, $jsonData, LOCK_EX);

        if ($result === false) {
            Logger::error('Failed to write index to temp file', ['path' => $tempPath]);
            return false;
        }

        if (!rename($tempPath, INDEX_PATH)) {
            Logger::error('Failed to rename temp index file', [
                'from' => $tempPath,
                'to' => INDEX_PATH
            ]);
            @unlink($tempPath);
            return false;
        }

        return true;
    }

    /**
     * Returns an empty index structure
     *
     * @return array Empty index
     */
    private function getEmptyIndex(): array
    {
        return [
            'recipes' => [],
            'lastUpdated' => null,
            'totalRecipes' => 0
        ];
    }

    /**
     * Ensures the storage directory exists and is writable
     *
     * @return bool True if directory exists/was created, false otherwise
     */
    private function ensureStorageDirectory(): bool
    {
        if (is_dir(STORAGE_PATH)) {
            return is_writable(STORAGE_PATH);
        }

        return mkdir(STORAGE_PATH, 0755, true);
    }
}
