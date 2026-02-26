<?php
declare(strict_types=1);

/**
 * RecipeExtractor
 *
 * Orchestrates recipe extraction from HTML using various extraction strategies.
 * Currently supports Schema.org JSON-LD extraction.
 */
class RecipeExtractor
{
    private $extractors = [];

    /**
     * Constructor - initializes available extractors
     */
    public function __construct()
    {
        // Register extractors in order of preference
        $this->extractors[] = new SchemaOrgExtractor();
    }

    /**
     * Extracts recipe data from HTML
     *
     * @param string $html The HTML content to extract from
     * @return array The extracted recipe data with metadata
     */
    public function extract(string $html): array
    {
        $startTime = microtime(true);

        // Try each extractor in order
        foreach ($this->extractors as $extractor) {
            if ($extractor->canExtract($html)) {
                $recipeData = $extractor->extract($html);

                if ($recipeData !== null) {
                    // Calculate processing time
                    $processingTimeMs = (int)((microtime(true) - $startTime) * 1000);

                    // Add metadata
                    $recipeData['metadata'] = [
                        'extractionMethod' => $this->getExtractorName($extractor),
                        'confidence' => $this->getConfidenceLevel($extractor),
                        'processingTimeMs' => $processingTimeMs,
                        'hasWarnings' => false,
                        'warnings' => []
                    ];

                    // Validate and add warnings if needed
                    $this->validateAndAddWarnings($recipeData);

                    Logger::info('Recipe extracted successfully', [
                        'method' => $recipeData['metadata']['extractionMethod'],
                        'confidence' => $recipeData['metadata']['confidence'],
                        'ingredients' => count($recipeData['ingredients'] ?? []),
                        'steps' => count($recipeData['steps'] ?? [])
                    ]);

                    return $recipeData;
                }
            }
        }

        // No extractor could extract the recipe
        $processingTimeMs = (int)((microtime(true) - $startTime) * 1000);

        Logger::warning('No recipe data could be extracted from HTML', [
            'processingTimeMs' => $processingTimeMs
        ]);

        return [
            'title' => null,
            'ingredients' => [],
            'steps' => [],
            'servings' => ['count' => null, 'unit' => 'servings'],
            'image' => null,
            'metadata' => [
                'extractionMethod' => 'none',
                'confidence' => 'low',
                'processingTimeMs' => $processingTimeMs,
                'hasWarnings' => true,
                'warnings' => ['No recipe data could be extracted from the page']
            ]
        ];
    }

    /**
     * Gets the name of an extractor
     *
     * @param object $extractor The extractor instance
     * @return string The extractor name
     */
    private function getExtractorName(object $extractor): string
    {
        $className = get_class($extractor);

        // Map class names to friendly names
        $nameMap = [
            'SchemaOrgExtractor' => 'schema.org',
        ];

        return $nameMap[$className] ?? strtolower($className);
    }

    /**
     * Gets the confidence level for an extractor
     *
     * @param object $extractor The extractor instance
     * @return string The confidence level (high, medium, low)
     */
    private function getConfidenceLevel(object $extractor): string
    {
        $className = get_class($extractor);

        // Map extractors to confidence levels
        $confidenceMap = [
            'SchemaOrgExtractor' => 'high', // Structured data is most reliable
        ];

        return $confidenceMap[$className] ?? 'low';
    }

    /**
     * Validates recipe data and adds warnings
     *
     * @param array &$recipeData The recipe data to validate (passed by reference)
     * @return void
     */
    private function validateAndAddWarnings(array &$recipeData): void
    {
        $warnings = [];

        // Check for missing title
        if (empty($recipeData['title'])) {
            $warnings[] = 'Recipe title is missing';
        }

        // Check for missing ingredients
        if (empty($recipeData['ingredients'])) {
            $warnings[] = 'No ingredients found';
        }

        // Check for missing steps
        if (empty($recipeData['steps'])) {
            $warnings[] = 'No cooking instructions found';
        }

        // Check for missing servings
        if (empty($recipeData['servings']['count'])) {
            $warnings[] = 'Serving size not specified';
        }

        // Update metadata
        if (!empty($warnings)) {
            $recipeData['metadata']['hasWarnings'] = true;
            $recipeData['metadata']['warnings'] = $warnings;
        }
    }
}
