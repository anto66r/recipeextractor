<?php
declare(strict_types=1);

/**
 * SchemaOrgExtractor
 *
 * Extracts recipe data from Schema.org JSON-LD structured data.
 * Looks for <script type="application/ld+json"> tags containing Recipe objects.
 */
class SchemaOrgExtractor
{
    /**
     * Checks if the HTML contains Schema.org JSON-LD recipe data
     *
     * @param string $html The HTML content to check
     * @return bool True if recipe data can be extracted, false otherwise
     */
    public function canExtract(string $html): bool
    {
        // Quick check for JSON-LD script tags
        if (stripos($html, 'application/ld+json') === false) {
            return false;
        }

        // Quick check for Recipe type
        if (stripos($html, '"@type"') === false || stripos($html, 'Recipe') === false) {
            return false;
        }

        return true;
    }

    /**
     * Extracts recipe data from HTML containing Schema.org JSON-LD
     *
     * @param string $html The HTML content to extract from
     * @return array|null The extracted recipe data or null if extraction fails
     */
    public function extract(string $html): ?array
    {
        if (!$this->canExtract($html)) {
            return null;
        }

        // Find all JSON-LD script tags
        $jsonLdBlocks = $this->extractJsonLdBlocks($html);

        if (empty($jsonLdBlocks)) {
            return null;
        }

        // Find Recipe objects
        foreach ($jsonLdBlocks as $jsonLd) {
            $recipe = $this->extractRecipeFromJsonLd($jsonLd);
            if ($recipe !== null) {
                return $recipe;
            }
        }

        return null;
    }

    /**
     * Extracts all JSON-LD blocks from HTML
     *
     * @param string $html The HTML content
     * @return array Array of decoded JSON-LD objects
     */
    private function extractJsonLdBlocks(string $html): array
    {
        $blocks = [];
        $pattern = '/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is';

        if (preg_match_all($pattern, $html, $matches)) {
            foreach ($matches[1] as $jsonString) {
                $decoded = json_decode(trim($jsonString), true);
                if ($decoded !== null) {
                    $blocks[] = $decoded;
                }
            }
        }

        return $blocks;
    }

    /**
     * Extracts recipe data from a JSON-LD object
     *
     * @param array $jsonLd The JSON-LD data
     * @return array|null The extracted recipe data or null
     */
    private function extractRecipeFromJsonLd(array $jsonLd): ?array
    {
        // Handle @graph structures
        if (isset($jsonLd['@graph']) && is_array($jsonLd['@graph'])) {
            foreach ($jsonLd['@graph'] as $item) {
                if ($this->isRecipeObject($item)) {
                    return $this->normalizeRecipe($item);
                }
            }
            return null;
        }

        // Handle direct Recipe object
        if ($this->isRecipeObject($jsonLd)) {
            return $this->normalizeRecipe($jsonLd);
        }

        return null;
    }

    /**
     * Checks if a JSON-LD object is a Recipe
     *
     * @param array $data The JSON-LD object
     * @return bool True if it's a Recipe object
     */
    private function isRecipeObject(array $data): bool
    {
        if (!isset($data['@type'])) {
            return false;
        }

        $type = $data['@type'];

        // Handle single type
        if (is_string($type)) {
            return $type === 'Recipe';
        }

        // Handle array of types
        if (is_array($type)) {
            return in_array('Recipe', $type, true);
        }

        return false;
    }

    /**
     * Normalizes recipe data to internal format
     *
     * @param array $recipe The raw recipe data
     * @return array The normalized recipe data
     */
    private function normalizeRecipe(array $recipe): array
    {
        return [
            'title' => $this->extractTitle($recipe),
            'ingredients' => $this->extractIngredients($recipe),
            'steps' => $this->extractSteps($recipe),
            'servings' => $this->extractServings($recipe),
            'image' => $this->extractImage($recipe)
        ];
    }

    /**
     * Extracts recipe title
     *
     * @param array $recipe The recipe data
     * @return string|null The recipe title
     */
    private function extractTitle(array $recipe): ?string
    {
        return isset($recipe['name']) && is_string($recipe['name'])
            ? trim($recipe['name'])
            : null;
    }

    /**
     * Extracts ingredients list
     *
     * @param array $recipe The recipe data
     * @return array Array of ingredient objects
     */
    private function extractIngredients(array $recipe): array
    {
        $ingredients = [];

        if (!isset($recipe['recipeIngredient']) || !is_array($recipe['recipeIngredient'])) {
            return $ingredients;
        }

        $order = 1;
        foreach ($recipe['recipeIngredient'] as $ingredient) {
            if (is_string($ingredient) && !empty(trim($ingredient))) {
                $ingredients[] = [
                    'order' => $order++,
                    'rawText' => trim($ingredient),
                    'quantity' => null,
                    'unit' => null,
                    'ingredient' => null,
                    'preparation' => null,
                    'originalQuantity' => null,
                    'originalUnit' => null
                ];
            }
        }

        return $ingredients;
    }

    /**
     * Extracts recipe steps/instructions
     *
     * @param array $recipe The recipe data
     * @return array Array of step objects
     */
    private function extractSteps(array $recipe): array
    {
        $steps = [];

        if (!isset($recipe['recipeInstructions'])) {
            return $steps;
        }

        $instructions = $recipe['recipeInstructions'];

        // Handle string instructions (split by newlines)
        if (is_string($instructions)) {
            $lines = preg_split('/\r\n|\r|\n/', trim($instructions));
            $order = 1;
            foreach ($lines as $line) {
                $line = trim($line);
                if (!empty($line)) {
                    $steps[] = [
                        'order' => $order++,
                        'instruction' => $line
                    ];
                }
            }
            return $steps;
        }

        // Handle array of instructions
        if (is_array($instructions)) {
            $order = 1;
            foreach ($instructions as $step) {
                $instruction = null;

                // Handle HowToStep objects
                if (is_array($step) && isset($step['@type']) && $step['@type'] === 'HowToStep') {
                    $instruction = $step['text'] ?? $step['name'] ?? null;
                } elseif (is_string($step)) {
                    $instruction = $step;
                }

                if ($instruction !== null && !empty(trim($instruction))) {
                    $steps[] = [
                        'order' => $order++,
                        'instruction' => trim($instruction)
                    ];
                }
            }
        }

        return $steps;
    }

    /**
     * Extracts serving information
     *
     * @param array $recipe The recipe data
     * @return array Servings data
     */
    private function extractServings(array $recipe): array
    {
        $servings = [
            'count' => null,
            'unit' => 'servings'
        ];

        if (isset($recipe['recipeYield'])) {
            $yield = $recipe['recipeYield'];

            // Handle string yield
            if (is_string($yield)) {
                // Try to extract number
                if (preg_match('/(\d+)/', $yield, $matches)) {
                    $servings['count'] = (int)$matches[1];
                }
            }

            // Handle numeric yield
            if (is_numeric($yield)) {
                $servings['count'] = (int)$yield;
            }

            // Handle array yield (take first element)
            if (is_array($yield) && !empty($yield)) {
                if (is_numeric($yield[0])) {
                    $servings['count'] = (int)$yield[0];
                } elseif (is_string($yield[0]) && preg_match('/(\d+)/', $yield[0], $matches)) {
                    $servings['count'] = (int)$matches[1];
                }
            }
        }

        return $servings;
    }

    /**
     * Extracts recipe image URL
     *
     * @param array $recipe The recipe data
     * @return string|null The image URL
     */
    private function extractImage(array $recipe): ?string
    {
        if (!isset($recipe['image'])) {
            return null;
        }

        $image = $recipe['image'];

        // Handle string URL
        if (is_string($image)) {
            return $image;
        }

        // Handle ImageObject
        if (is_array($image)) {
            // Handle array of images
            if (isset($image[0])) {
                $firstImage = $image[0];
                if (is_string($firstImage)) {
                    return $firstImage;
                }
                if (is_array($firstImage) && isset($firstImage['url'])) {
                    return $firstImage['url'];
                }
            }

            // Handle single ImageObject
            if (isset($image['url'])) {
                return $image['url'];
            }
        }

        return null;
    }
}
