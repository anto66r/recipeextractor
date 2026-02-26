# System Architecture: Recipe Extractor

**Version:** 1.0
**Last Updated:** 2026-02-26
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architectural Overview](#architectural-overview)
3. [Design Philosophy](#design-philosophy)
4. [Folder Structure](#folder-structure)
5. [Component Architecture](#component-architecture)
6. [Data Model](#data-model)
7. [Key Design Decisions](#key-design-decisions)
8. [Implementation Order](#implementation-order)
9. [Risks and Mitigations](#risks-and-mitigations)
10. [Hosting Constraints](#hosting-constraints)

---

## Executive Summary

Recipe Extractor is a **simple, pragmatic PHP application** designed for shared hosting environments. It follows a **layered architecture** with clear separation of concerns, using **flat-file JSON storage** instead of a database.

**Key Architectural Principles:**

- **Simplicity first** - No framework, no database, minimal dependencies
- **Shared hosting compatible** - Works within strict hosting constraints
- **Maintainable** - Clear separation of concerns, easy to debug
- **Resilient** - Graceful degradation, comprehensive error handling

**Technology Stack:**

- **Language:** PHP 7.4+ (vanilla PHP, no framework)
- **HTTP Client:** cURL (with file_get_contents fallback)
- **HTML Parsing:** DOMDocument, SimpleXMLElement
- **Storage:** Flat-file JSON with atomic writes
- **Hosting:** Hostinger shared hosting

---

## Architectural Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Request
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Entry Point (index.php)                  │
│                  - Routing & Request Handling               │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   URL Input  │  │  Tag Manager │  │Recipe Scaler │
│   Handler    │  │              │  │              │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              Core Processing Layer                       │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │   Page     │→ │  Recipe    │→ │  Storage   │       │
│  │  Fetcher   │  │ Extractor  │  │  Manager   │       │
│  └────────────┘  └────────────┘  └────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Utility    │  │ Measurement │  │  Auto       │
│  Classes    │  │ Converter   │  │  Tagger     │
└─────────────┘  └─────────────┘  └─────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  File System        │
              │  - /recipes/data/   │
              │  - /logs/           │
              │  - /config/         │
              └─────────────────────┘
```

### Request Flow

**1. Recipe Extraction Flow:**

```
User submits URL
    ↓
Validate URL format (filter_var)
    ↓
Fetch page content (cURL)
    ↓
Parse HTML (DOMDocument)
    ↓
Extract recipe data (Schema.org → hRecipe → heuristic)
    ↓
Convert measurements to metric
    ↓
Suggest auto-tags
    ↓
Generate UUID
    ↓
Save as JSON file (atomic write)
    ↓
Update index.json
    ↓
Return success/error to user
```

**2. Error Handling Flow:**

```
Error occurs at any step
    ↓
Log to /logs/error.log (timestamp, context)
    ↓
Return user-friendly error message
    ↓
Preserve partial data if possible (with warning flag)
```

---

## Design Philosophy

### Core Principles

**1. Keep It Simple (KISS)**
- No framework overhead - vanilla PHP
- No database - flat-file JSON storage
- Minimal external dependencies
- Single-file classes where appropriate

**2. Fail Gracefully**
- Never show raw PHP errors to users
- Always log errors with context
- Save partial data when possible
- Provide clear feedback on failures

**3. Optimize for Maintainability**
- Clear class responsibilities (single responsibility principle)
- Explicit error handling (no silent failures)
- Self-documenting code with docblocks
- Configuration externalized to JSON files

**4. Respect Hosting Constraints**
- No background jobs or cron
- No CLI access required
- Standard shared hosting PHP setup
- File-based storage (no database)
- Reasonable memory/execution limits

### What We Avoid

- **No framework** - Overhead not justified for this simple app
- **No database** - File storage sufficient for expected scale (<10k recipes)
- **No ORM** - Direct JSON serialization is simpler
- **No dependency manager** (Composer) - Keep deployment simple
- **No JavaScript build process** - Pure PHP rendering
- **No authentication (v1)** - Single-user assumption

---

## Folder Structure

### Recommended Directory Layout

```
/var/www/html/recipeextractor/          (web root on Hostinger)
│
├── index.php                            (entry point, routing)
├── .htaccess                            (URL rewriting, security headers)
├── config.php                           (app configuration constants)
│
├── /src/                                (application code)
│   ├── /Core/
│   │   ├── PageFetcher.php             (cURL wrapper, HTTP client)
│   │   ├── RecipeExtractor.php         (main extraction orchestrator)
│   │   ├── StorageManager.php          (JSON file operations)
│   │   └── Router.php                  (simple routing logic)
│   │
│   ├── /Extractors/
│   │   ├── SchemaOrgExtractor.php      (JSON-LD, microdata)
│   │   ├── HRecipeExtractor.php        (hRecipe microformat)
│   │   └── HeuristicExtractor.php      (fallback HTML parsing)
│   │
│   ├── /Services/
│   │   ├── MeasurementConverter.php    (imperial → metric)
│   │   ├── AutoTagger.php              (rules-based tagging)
│   │   ├── RecipeScaler.php            (quantity scaling)
│   │   └── ImageExtractor.php          (find primary image)
│   │
│   ├── /Utils/
│   │   ├── Validator.php               (input validation)
│   │   ├── Logger.php                  (error logging)
│   │   └── UUID.php                    (UUID generation)
│   │
│   └── /Views/
│       ├── form.php                    (URL submission form)
│       ├── result.php                  (extraction result display)
│       └── error.php                   (error message display)
│
├── /recipes/                            (data storage - writable)
│   ├── /data/                          (individual recipe JSON files)
│   │   ├── 550e8400-e29b-41d4-a716-446655440000.json
│   │   └── 662f9511-f30c-52e5-b827-557766551111.json
│   └── index.json                      (lightweight recipe index)
│
├── /logs/                               (application logs - writable)
│   └── error.log                       (all errors logged here)
│
├── /config/                             (configuration files)
│   ├── tagging-rules.json              (auto-tagging keyword rules)
│   └── conversion-factors.json         (measurement conversion data)
│
└── /tests/                              (optional: simple test files)
    ├── test-fetch.php
    ├── test-extract.php
    └── test-convert.php
```

### Key Points

- **`/src/`** contains all application logic, organized by responsibility
- **`/recipes/data/`** must be writable by web server (chmod 755 or 775)
- **`/logs/`** must be writable for error logging
- **`/config/`** contains JSON config files (read-only)
- **`index.php`** is the only public entry point (all requests route through it)
- **`.htaccess`** handles URL rewriting and security headers

---

## Component Architecture

### Layer 1: Entry Point & Routing

**`index.php`** - Single entry point for all requests

```php
<?php
// index.php - Entry point & routing

require_once 'config.php';
require_once 'src/Core/Router.php';

// Initialize router
$router = new Router();

// Define routes
$router->get('/', 'HomeController@index');           // Show form
$router->post('/extract', 'ExtractController@extract'); // Process URL
$router->post('/tag', 'TagController@update');        // Update tags
$router->post('/scale', 'ScaleController@scale');     // Scale recipe

// Run
$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
```

**`config.php`** - Application configuration constants

```php
<?php
// config.php - Application configuration

define('APP_ROOT', __DIR__);
define('STORAGE_PATH', APP_ROOT . '/recipes/data');
define('INDEX_PATH', APP_ROOT . '/recipes/index.json');
define('LOG_PATH', APP_ROOT . '/logs/error.log');
define('CONFIG_PATH', APP_ROOT . '/config');

// HTTP settings
define('FETCH_TIMEOUT', 15);      // seconds
define('MAX_REDIRECTS', 3);
define('MAX_RETRIES', 2);
define('USER_AGENT', 'RecipeExtractor/1.0 (Personal Use)');

// Extraction settings
define('MIN_CONFIDENCE', 0.5);    // 50% confidence threshold
define('MAX_INGREDIENTS', 100);   // sanity check
define('MAX_STEPS', 50);          // sanity check

// File locking
define('LOCK_TIMEOUT', 5);        // seconds
```

---

### Layer 2: Core Processing Classes

#### **PageFetcher.php** - HTTP client for fetching web pages

**Responsibilities:**
- Fetch HTML content via cURL
- Handle redirects, timeouts, errors
- Fallback to file_get_contents if cURL unavailable
- Retry logic for transient failures

**Key Methods:**
```php
class PageFetcher {
    public function fetch(string $url): array {
        // Returns ['success' => true, 'html' => '...', 'statusCode' => 200]
        // or ['success' => false, 'error' => 'message']
    }

    private function fetchWithCurl(string $url): string;
    private function fetchWithFileGetContents(string $url): string;
    private function retry(callable $fn, int $maxRetries): mixed;
}
```

---

#### **RecipeExtractor.php** - Main extraction orchestrator

**Responsibilities:**
- Coordinate extraction strategy (Schema.org → hRecipe → heuristic)
- Call appropriate extractor classes
- Determine confidence level
- Assemble final recipe data structure

**Key Methods:**
```php
class RecipeExtractor {
    private $extractors = [];  // [SchemaOrgExtractor, HRecipeExtractor, HeuristicExtractor]

    public function extract(string $html, string $url): array {
        // Try each extractor in order until one succeeds
        // Returns recipe data array with confidence level
    }

    private function normalizeRecipeData(array $raw): array;
    private function calculateConfidence(array $data): float;
}
```

---

#### **StorageManager.php** - JSON file operations

**Responsibilities:**
- Save recipe to JSON file (atomic write)
- Load recipe from JSON file
- Update index.json
- File locking for concurrent safety
- Handle file system errors gracefully

**Key Methods:**
```php
class StorageManager {
    public function save(string $id, array $recipeData): bool;
    public function load(string $id): ?array;
    public function delete(string $id): bool;
    public function updateIndex(string $id, array $metadata): bool;
    public function getAllRecipes(): array;  // Read from index.json

    private function atomicWrite(string $path, string $content): bool;
    private function acquireLock($handle, int $timeout): bool;
}
```

**Atomic Write Pattern:**
```php
// Write to temp file, then rename (atomic operation)
$tempFile = $targetPath . '.tmp';
file_put_contents($tempFile, $json, LOCK_EX);
rename($tempFile, $targetPath);  // Atomic on Unix systems
```

---

### Layer 3: Specialized Extractors

#### **SchemaOrgExtractor.php** - Extract from Schema.org markup

**Handles:**
- JSON-LD structured data (`<script type="application/ld+json">`)
- Microdata attributes (`itemtype="https://schema.org/Recipe"`)

**Key Methods:**
```php
class SchemaOrgExtractor {
    public function canExtract(string $html): bool;
    public function extract(string $html): ?array;

    private function extractJsonLd(DOMDocument $dom): ?array;
    private function extractMicrodata(DOMDocument $dom): ?array;
    private function parseRecipeSchema(array $schema): array;
}
```

---

#### **HRecipeExtractor.php** - Extract from hRecipe microformat

**Handles:**
- hRecipe microformat (older format, less common)
- Class-based markup (`class="ingredient"`, `class="instructions"`)

**Key Methods:**
```php
class HRecipeExtractor {
    public function canExtract(string $html): bool;
    public function extract(string $html): ?array;

    private function findHRecipeElement(DOMDocument $dom): ?DOMElement;
    private function extractIngredients(DOMElement $recipe): array;
    private function extractSteps(DOMElement $recipe): array;
}
```

---

#### **HeuristicExtractor.php** - Fallback HTML parsing

**Handles:**
- Unstructured HTML with common patterns
- Look for `<ul>` or `<ol>` lists for ingredients
- Look for numbered steps or ordered lists
- Heuristic confidence scoring

**Key Methods:**
```php
class HeuristicExtractor {
    public function extract(string $html): ?array;

    private function findIngredientsList(DOMDocument $dom): ?DOMElement;
    private function findStepsList(DOMDocument $dom): ?DOMElement;
    private function scoreConfidence(array $data): float;

    // Look for common keywords: "ingredients", "directions", "instructions"
    private function findSectionByKeywords(DOMDocument $dom, array $keywords): ?DOMElement;
}
```

---

### Layer 4: Service Classes

#### **MeasurementConverter.php** - Unit conversion

**Responsibilities:**
- Convert imperial to metric (cups → ml, oz → g)
- Temperature conversion (F → C)
- Parse quantity strings ("2 1/2 cups", "1.5 tablespoons")
- Preserve original values

**Key Methods:**
```php
class MeasurementConverter {
    private $conversionFactors = [];  // Loaded from config/conversion-factors.json

    public function convertToMetric(float $quantity, string $unit): array {
        // Returns ['quantity' => 240, 'unit' => 'ml', 'original' => ['quantity' => 1, 'unit' => 'cup']]
    }

    public function parseQuantityString(string $text): ?array {
        // Parse "2 1/2 cups" → ['quantity' => 2.5, 'unit' => 'cups']
    }

    private function loadConversionFactors(): array;
}
```

**Conversion Factors Config** (`config/conversion-factors.json`):
```json
{
  "volume": {
    "cup": { "ml": 240 },
    "tablespoon": { "ml": 15 },
    "teaspoon": { "ml": 5 },
    "fluid ounce": { "ml": 30 }
  },
  "weight": {
    "ounce": { "g": 28.35 },
    "pound": { "g": 453.6 }
  },
  "temperature": {
    "fahrenheit_to_celsius": "(F - 32) * 5 / 9"
  }
}
```

---

#### **AutoTagger.php** - Rules-based tagging

**Responsibilities:**
- Analyze recipe title, ingredients, steps
- Match against keyword rules
- Suggest tags based on content
- Load rules from config file

**Key Methods:**
```php
class AutoTagger {
    private $rules = [];  // Loaded from config/tagging-rules.json

    public function suggestTags(array $recipe): array {
        // Returns ['dietary' => ['vegan'], 'cuisine' => ['italian'], ...]
    }

    private function matchDietaryTags(string $text): array;
    private function matchCuisineTags(string $text): array;
    private function matchMealTypeTags(string $text): array;
    private function matchMethodTags(string $text): array;
}
```

**Tagging Rules Config** (`config/tagging-rules.json`):
```json
{
  "dietary": {
    "vegan": {
      "include": ["tofu", "tempeh", "chickpeas", "lentils"],
      "exclude": ["chicken", "beef", "pork", "fish", "egg", "milk", "cheese"]
    },
    "vegetarian": {
      "exclude": ["chicken", "beef", "pork", "fish", "meat"]
    }
  },
  "cuisine": {
    "italian": ["pasta", "risotto", "parmesan", "basil", "mozzarella"],
    "mexican": ["taco", "salsa", "tortilla", "cilantro", "lime"]
  },
  "meal_type": {
    "breakfast": ["egg", "pancake", "waffle", "breakfast"],
    "dessert": ["sugar", "chocolate", "cake", "cookie", "frosting"]
  }
}
```

---

#### **RecipeScaler.php** - Quantity scaling

**Responsibilities:**
- Scale ingredient quantities by factor
- Preserve units
- Round to sensible precision
- Handle edge cases (non-scalable items like "1 egg" → "2 eggs")

**Key Methods:**
```php
class RecipeScaler {
    public function scale(array $recipe, float $factor): array {
        // Returns new recipe with scaled quantities
    }

    public function scaleByServings(array $recipe, int $targetServings): array {
        // Calculate factor from original servings, then scale
    }

    private function roundToSensiblePrecision(float $value, string $unit): float;
}
```

---

#### **ImageExtractor.php** - Extract primary image

**Responsibilities:**
- Extract image URL from recipe page
- Priority: Schema.org → Open Graph → heuristic
- Return absolute URL
- No image download/storage

**Key Methods:**
```php
class ImageExtractor {
    public function extract(string $html, string $baseUrl): ?array {
        // Returns ['url' => '...', 'source' => 'schema.org'] or null
    }

    private function extractFromSchema(DOMDocument $dom): ?string;
    private function extractFromOpenGraph(DOMDocument $dom): ?string;
    private function extractHeuristic(DOMDocument $dom, string $baseUrl): ?string;
    private function makeAbsoluteUrl(string $url, string $baseUrl): string;
}
```

---

### Layer 5: Utility Classes

#### **Validator.php** - Input validation

**Responsibilities:**
- Validate URLs (format, scheme)
- Sanitize user input
- Validate recipe data structure

**Key Methods:**
```php
class Validator {
    public static function isValidUrl(string $url): bool;
    public static function sanitizeUrl(string $url): string;
    public static function validateRecipeData(array $data): array;  // Returns validation errors
}
```

---

#### **Logger.php** - Error logging

**Responsibilities:**
- Write errors to log file
- Include timestamp, context, stack trace
- Rotate logs if file gets too large

**Key Methods:**
```php
class Logger {
    public static function error(string $message, array $context = []): void;
    public static function warning(string $message, array $context = []): void;
    public static function info(string $message, array $context = []): void;

    private static function write(string $level, string $message, array $context): void;
}
```

**Log Format:**
```
[2026-02-26 14:35:22] ERROR: Failed to fetch URL: https://example.com/recipe
Context: {"error": "cURL timeout after 15s", "statusCode": null, "retries": 2}
Trace: PageFetcher.php:45 -> RecipeExtractor.php:78 -> index.php:23
```

---

#### **UUID.php** - UUID generation

**Responsibilities:**
- Generate UUID v4 for recipe IDs
- Simple, dependency-free implementation

**Key Methods:**
```php
class UUID {
    public static function v4(): string {
        // Returns: "550e8400-e29b-41d4-a716-446655440000"
    }
}
```

---

## Data Model

### Recipe JSON Schema

**File:** `/recipes/data/{uuid}.json`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/chocolate-chip-cookies",
  "title": "Classic Chocolate Chip Cookies",
  "extractedAt": "2026-02-26T10:30:00Z",
  "servings": {
    "count": 24,
    "unit": "cookies"
  },
  "image": {
    "url": "https://example.com/images/cookies.jpg",
    "source": "schema.org"
  },
  "tags": {
    "manual": ["favorite", "holiday"],
    "auto": ["dessert", "baked", "quick"],
    "rejected": ["gluten-free"]
  },
  "ingredients": [
    {
      "order": 1,
      "rawText": "2 cups all-purpose flour",
      "quantity": 480,
      "unit": "ml",
      "ingredient": "all-purpose flour",
      "preparation": null,
      "originalQuantity": 2,
      "originalUnit": "cups"
    },
    {
      "order": 2,
      "rawText": "1 cup butter, softened",
      "quantity": 240,
      "unit": "ml",
      "ingredient": "butter",
      "preparation": "softened",
      "originalQuantity": 1,
      "originalUnit": "cup"
    }
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "Preheat oven to 375°F (190°C)."
    },
    {
      "order": 2,
      "instruction": "Mix flour and baking soda in a bowl."
    }
  ],
  "metadata": {
    "extractionMethod": "schema.org",
    "confidence": "high",
    "processingTimeMs": 1250,
    "lastModified": "2026-02-26T10:30:00Z",
    "hasWarnings": false,
    "warnings": []
  }
}
```

### Index JSON Schema

**File:** `/recipes/index.json`

Lightweight index for quick lookups without reading all recipe files.

```json
{
  "recipes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Classic Chocolate Chip Cookies",
      "url": "https://example.com/chocolate-chip-cookies",
      "extractedAt": "2026-02-26T10:30:00Z",
      "tags": ["favorite", "holiday", "dessert", "baked", "quick"]
    },
    {
      "id": "662f9511-f30c-52e5-b827-557766551111",
      "title": "Spaghetti Carbonara",
      "url": "https://example.com/carbonara",
      "extractedAt": "2026-02-25T15:20:00Z",
      "tags": ["italian", "pasta", "dinner"]
    }
  ],
  "lastUpdated": "2026-02-26T10:30:00Z",
  "totalRecipes": 2
}
```

### Field Descriptions

**Core Fields:**
- `id` (string, UUID v4) - Unique identifier, used as filename
- `url` (string) - Source URL where recipe was extracted
- `title` (string, optional) - Recipe title if found
- `extractedAt` (ISO 8601 timestamp) - When extraction occurred

**Servings:**
- `servings.count` (integer, optional) - Number of servings
- `servings.unit` (string, optional) - "servings", "portions", "cookies", etc.

**Image:**
- `image.url` (string, optional) - Absolute URL to primary image
- `image.source` (enum: "schema.org", "og:image", "heuristic") - How image was found

**Tags:**
- `tags.manual` (array of strings) - User-added tags
- `tags.auto` (array of strings) - Auto-suggested tags (user accepted)
- `tags.rejected` (array of strings) - Auto-suggested tags user rejected

**Ingredients:**
- `order` (integer) - Sequence number
- `rawText` (string, required) - Original text from source
- `quantity` (float, optional) - Numeric quantity in metric
- `unit` (string, optional) - Metric unit (ml, g, kg, liters)
- `ingredient` (string, optional) - Ingredient name
- `preparation` (string, optional) - "chopped", "diced", "softened"
- `originalQuantity` (float, optional) - If converted from imperial
- `originalUnit` (string, optional) - If converted from imperial

**Steps:**
- `order` (integer) - Sequence number
- `instruction` (string, required) - Step text

**Metadata:**
- `extractionMethod` (enum: "schema.org", "hrecipe", "heuristic") - Which extractor succeeded
- `confidence` (enum: "high", "medium", "low") - Extraction confidence
- `processingTimeMs` (integer) - Time taken to extract
- `lastModified` (ISO 8601 timestamp) - Last update time
- `hasWarnings` (boolean) - If partial extraction
- `warnings` (array of strings) - Warning messages if any

---

## Key Design Decisions

### ADR References

See detailed Architecture Decision Records in `/docs/adr/`:

1. **ADR-001: Use Flat-File JSON Storage Instead of Database**
2. **ADR-002: Use Vanilla PHP Without Framework**
3. **ADR-003: Multi-Strategy Extraction Pattern**
4. **ADR-004: Store All Measurements in Metric**
5. **ADR-005: Atomic File Writes with Rename Pattern**

### Decision Summary

#### 1. Flat-File JSON Storage (No Database)

**Decision:** Store each recipe as individual JSON file (`{uuid}.json`)

**Rationale:**
- Shared hosting constraint (no database access guaranteed)
- Expected scale is modest (<10k recipes)
- Simple backup/restore (copy directory)
- Human-readable for debugging
- No database maintenance overhead
- File system performance adequate for use case

**Tradeoffs:**
- Slower search/filter operations (must read multiple files)
- No ACID transactions across recipes
- Index file must be manually maintained
- Not suitable for high concurrency

**Mitigation:**
- Implement lightweight index.json for metadata queries
- Use file locking (LOCK_EX) for concurrent safety
- Consider moving to SQLite if scale exceeds 10k recipes

---

#### 2. Vanilla PHP (No Framework)

**Decision:** Use vanilla PHP without Symfony, Laravel, or other frameworks

**Rationale:**
- Simplicity for single-purpose app
- No framework learning curve
- Minimal deployment complexity
- Full control over behavior
- Faster for shared hosting (no framework bootstrap overhead)

**Tradeoffs:**
- Must implement routing, validation, error handling manually
- No framework security features (CSRF, XSS helpers)
- Less structure/conventions

**Mitigation:**
- Build simple Router class for clean URLs
- Use well-structured class organization
- Implement custom Validator and Logger utilities
- Consider framework if app grows significantly

---

#### 3. Multi-Strategy Extraction Pattern

**Decision:** Try extractors in priority order: Schema.org → hRecipe → Heuristic

**Rationale:**
- Maximize extraction success rate across diverse websites
- Structured data (Schema.org) is most reliable
- Graceful degradation to heuristics
- Clear confidence levels help users

**Implementation:**
```php
foreach ($this->extractors as $extractor) {
    if ($extractor->canExtract($html)) {
        $data = $extractor->extract($html);
        if ($data && $this->isValidRecipe($data)) {
            return $data;
        }
    }
}
// All extractors failed
return null;
```

---

#### 4. Metric Storage Standard

**Decision:** Store all quantities in metric units (g, ml, kg, liters)

**Rationale:**
- International standard (most countries use metric)
- Consistent calculations (scaling, conversions)
- Avoid unit confusion
- Original values preserved for reference

**Implementation:**
- Convert on extraction (before storage)
- Store both metric and original values
- Display can show either format

---

#### 5. Atomic File Writes

**Decision:** Use temp file + rename pattern for safe writes

**Rationale:**
- Prevent corrupted JSON files if write interrupted
- Atomic rename operation (on Unix systems)
- File locking for concurrent write safety

**Implementation:**
```php
$tempFile = $targetPath . '.tmp.' . uniqid();
file_put_contents($tempFile, $json, LOCK_EX);
rename($tempFile, $targetPath);  // Atomic
```

**Tradeoff:** Slightly more complex, but prevents data corruption.

---

## Implementation Order

### Sprint 1: Core Extraction Pipeline (Must-Have)

**Goal:** Minimum viable extraction - user submits URL, gets recipe JSON

**Stories:**
1. **FR-1: URL Submission** - Build form, validate URL format
2. **FR-2: Page Fetching** - Implement PageFetcher with cURL
3. **FR-3: Recipe Extraction** - Implement SchemaOrgExtractor only (defer hRecipe/heuristic)
4. **FR-4: Data Storage** - Implement StorageManager with atomic writes

**Deliverables:**
- Working end-to-end flow: URL → fetch → extract → save → display
- Error handling and logging
- Basic success/error views

**Acceptance Criteria:**
- Can extract recipes from Schema.org-compliant sites
- Files saved to `/recipes/data/`
- User sees success message with recipe details

---

### Sprint 2: Data Enhancement (Must-Have)

**Goal:** Complete measurement conversion and manual tagging

**Stories:**
5. **FR-7: Measurement Conversion** - Implement MeasurementConverter
6. **FR-5: Manual Tagging** - Build tag management UI

**Deliverables:**
- All quantities converted to metric
- Users can add/remove tags on recipes
- Tags persist in JSON files

**Acceptance Criteria:**
- Conversion accuracy within 2% tolerance
- Original values preserved
- Tags normalized (lowercase, trimmed)

---

### Sprint 3: Intelligent Features (Should-Have)

**Goal:** Add auto-tagging, image extraction, robust error handling

**Stories:**
7. **FR-6: Auto-Tag Suggestion** - Implement AutoTagger with rules
8. **FR-9: Image Extraction** - Implement ImageExtractor
9. **FR-10: Error Handling** - Comprehensive error handling and logging

**Deliverables:**
- Auto-suggested tags with accept/reject UI
- Primary images extracted and displayed
- User-friendly error messages for all failure modes

**Acceptance Criteria:**
- 70%+ tag acceptance rate
- 80%+ image extraction success
- No raw PHP errors shown to users

---

### Sprint 4: User Experience (Should-Have)

**Goal:** Recipe scaling and extraction strategy completion

**Stories:**
10. **FR-8: Recipe Scaling** - Implement RecipeScaler
11. **Extraction Strategy Completion** - Add HRecipeExtractor and HeuristicExtractor

**Deliverables:**
- Users can scale recipes by factor or serving count
- Extraction works on sites without Schema.org markup

**Acceptance Criteria:**
- Scaled quantities sensibly rounded
- Heuristic extraction achieves 60%+ success rate
- Confidence levels accurately reflect extraction quality

---

## Risks and Mitigations

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Websites block scraping** | Medium | High | Implement respectful User-Agent, rate limiting, robots.txt compliance. Document known blocked sites. |
| **HTML structure varies widely** | High | High | Multi-strategy extraction (structured data first, heuristics last). Graceful degradation. |
| **Extraction accuracy insufficient** | Medium | Medium | Start with popular recipe sites (good markup). Iterate on parser. Show confidence levels. |
| **JavaScript-required sites** | Medium | Medium | Document limitation. Consider headless browser in v2 if needed. |
| **File system performance** | Low | Medium | Implement index.json for metadata queries. Archive old recipes. |
| **Shared hosting limits** | Medium | Medium | Keep execution time under 30s. Use memory-efficient parsing. Test on Hostinger. |
| **Concurrent writes** | Low | Low | File locking (LOCK_EX) and atomic writes. Conflicts are rare (single user). |
| **Measurement conversion errors** | Low | Medium | Comprehensive testing. Use standard conversion factors. Allow manual override. |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **User abandonment** | Medium | High | Keep extraction time under 30s. Show progress feedback. Provide clear error messages. |
| **Data quality issues** | Medium | Medium | Show confidence levels. Allow manual editing. Improve extractors iteratively. |
| **Scale exceeds flat-file limits** | Low | Medium | Monitor recipe count and performance. Plan migration to SQLite if needed (10k+ recipes). |

---

## Hosting Constraints

### Hostinger Shared Hosting Specifics

**Environment:**
- **PHP Version:** 7.4+ (configurable via control panel)
- **Web Server:** LiteSpeed or Apache
- **File System:** Standard Unix permissions
- **No CLI/SSH Access:** All operations via web interface
- **No Cron Jobs:** No background task scheduling
- **No Database** (assumed): File-based storage only

**Limitations:**
- **Execution Time:** Default 30-60 seconds (may be configurable)
- **Memory Limit:** Typically 128-256 MB
- **File Upload Size:** Default 64-128 MB
- **Concurrent Connections:** Shared hosting limits apply

**Required Permissions:**
```bash
# Directories must be writable by web server
chmod 755 /recipes/data/
chmod 755 /logs/
```

**`.htaccess` Configuration:**

```apache
# .htaccess - Security and URL rewriting

# Prevent directory listing
Options -Indexes

# Protect sensitive files
<FilesMatch "^(config\.php|.*\.log)$">
    Order Allow,Deny
    Deny from all
</FilesMatch>

# URL rewriting
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]

# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set X-XSS-Protection "1; mode=block"

# Prevent access to hidden files
RedirectMatch 403 /\..*$

# PHP settings (if allowed by hosting)
php_value upload_max_filesize 10M
php_value post_max_size 10M
php_value max_execution_time 30
php_value max_input_time 30
php_value memory_limit 128M
```

**Deployment Steps:**

1. Upload all files via FTP/SFTP to subdomain directory
2. Set directory permissions:
   - `/recipes/data/` → 755
   - `/logs/` → 755
   - All other files → 644
3. Verify `.htaccess` is loaded (test URL rewriting)
4. Test with sample URL extraction
5. Monitor `/logs/error.log` for issues

**Testing Checklist:**

- [ ] PHP version is 7.4 or higher
- [ ] cURL extension is enabled
- [ ] DOMDocument class is available
- [ ] File writes succeed to `/recipes/data/`
- [ ] File writes succeed to `/logs/`
- [ ] `.htaccess` rewrite rules work
- [ ] Execution completes within 30 seconds for typical recipe
- [ ] Memory usage stays under 128 MB

---

## Next Steps

1. **Review this architecture document** with stakeholders
2. **Create ADR documents** in `/docs/adr/` for key decisions
3. **Set up development environment** (local PHP server for testing)
4. **Begin Sprint 1 implementation** (Core Extraction Pipeline)
5. **Test on Hostinger** early (validate hosting constraints)

---

**Document Status:** Draft
**Approval Required:** Yes
**Next Review Date:** After Sprint 1 completion
