# Product Requirements Document: Recipe Extractor

**Version:** 1.2
**Last Updated:** 2026-02-26
**Status:** Draft
**Owner:** Product Management

---

## Executive Summary

Recipe Extractor is a pragmatic recipe database application that solves the problem of capturing and organizing recipe data from web pages. Users can submit URLs to recipe pages, and the system automatically extracts structured recipe information (ingredients, steps, and images) into a clean, queryable format for storage and future use. The application is built with PHP for shared hosting environments, stores recipes as flat files, and includes intelligent tagging, measurement conversion capabilities, and recipe image illustration.

---

## Problem Statement

### Current Situation
Home cooks and culinary enthusiasts frequently find recipes scattered across numerous websites. These recipes exist in various formats with inconsistent structure, making it difficult to:
- Maintain a personal collection of favorite recipes
- Search through saved recipes efficiently
- Organize recipe data programmatically
- Extract key information without manual copy-paste
- Work with recipes that use different measurement systems
- Categorize and filter recipes by type, cuisine, or dietary needs

### Pain Points
1. **Information Fragmentation** - Recipes saved as bookmarks or browser tabs are hard to search and organize
2. **Inconsistent Formats** - Each website presents recipes differently, requiring manual reformatting
3. **Manual Data Entry** - Copying ingredients and steps is time-consuming and error-prone
4. **Loss of Access** - Websites go offline or change URLs, making saved bookmarks useless
5. **Measurement Confusion** - Recipes from different regions use different measurement systems (imperial vs. metric)
6. **Poor Organization** - No easy way to categorize recipes by type, cuisine, or dietary restrictions
7. **Recipe Scaling** - Difficult to adjust ingredient quantities for different serving sizes

### Opportunity
Build a focused tool that transforms unstructured web recipe pages into structured database records, enabling users to build a searchable personal recipe library with automatic measurement standardization and intelligent tagging.

---

## Goals & Success Metrics

### Primary Goals
1. **Enable URL-based recipe capture** - Users can add recipes by submitting a URL
2. **Automate extraction** - System reliably extracts ingredients and steps without manual intervention
3. **Structure data consistently** - All recipes stored in uniform schema regardless of source
4. **Standardize measurements** - All recipes stored in metric units with conversion capabilities
5. **Enable intelligent organization** - Automatic and manual tagging for easy categorization

### Success Metrics
- **Extraction Accuracy:** 90%+ accuracy on ingredient and step extraction from supported sites
- **Time Saved:** 80% reduction vs. manual copy-paste (target: <30 seconds per recipe)
- **User Adoption:** Users successfully save 5+ recipes within first week
- **Measurement Accuracy:** 95%+ accuracy on unit conversion and scaling calculations
- **Tagging Utility:** 70%+ of auto-suggested tags accepted by users

### Non-Goals (Out of Scope)
- Recipe search or filtering UI (v1)
- Recipe editing or modification (v1)
- Social sharing or collaborative features
- Mobile applications
- Nutrition calculation
- Recipe recommendation engine
- User authentication (v1 - single user assumed)
- Meal planning features
- Shopping list generation (v1)

---

## User Personas

### Primary Persona: Alex - The Home Cook Organizer
- **Demographics:** 28-45 years old, cooks 3-5 times per week
- **Behavior:** Collects recipes from blogs, YouTube, and cooking sites (international sources)
- **Pain:** Has 100+ browser bookmarks with no organization; loses track of recipes; struggles with converting measurements
- **Need:** Simple way to save recipe data for future reference with consistent measurement format
- **Technical Comfort:** Comfortable with web applications, basic tech-savvy

### Secondary Persona: Jamie - The Recipe Curator
- **Demographics:** 35-55 years old, passionate home chef
- **Behavior:** Tests multiple versions of dishes, maintains recipe notes, adjusts serving sizes frequently
- **Pain:** Manually types recipes into notes apps or spreadsheets; constantly recalculates ingredient amounts
- **Need:** Quick capture of recipe structure to build personal database with easy scaling
- **Technical Comfort:** Moderate; values simplicity and reliability

---

## Functional Requirements

### FR-1: URL Submission
**Priority:** Must Have
**Description:** User can submit a URL pointing to a recipe web page.

**Acceptance Criteria:**
- System accepts valid HTTP/HTTPS URLs
- System validates URL format before processing
- System provides feedback on submission status (success/failure)

---

### FR-2: Page Fetching
**Priority:** Must Have
**Description:** System fetches and reads the content of the provided URL using PHP.

**Acceptance Criteria:**
- System successfully retrieves HTML content from valid URLs using cURL
- System handles common HTTP errors (404, 500, timeout)
- System follows redirects (up to 3 hops)
- System respects robots.txt and implements respectful rate limiting
- Timeout after 15 seconds to prevent hanging

**Technical Considerations:**
- Handle HTTPS certificates properly with cURL
- Set appropriate User-Agent header
- Implement retry logic for transient failures (max 2 retries)
- Compatible with shared hosting environment (no CLI/background jobs)

---

### FR-3: Recipe Extraction
**Priority:** Must Have
**Description:** System extracts structured recipe data from page content using PHP parsing libraries.

**Acceptance Criteria:**
- System identifies and extracts ingredient list with quantities
- System identifies and extracts cooking/preparation steps in order
- System handles common recipe markup formats (Schema.org Recipe, hRecipe)
- System falls back to heuristic parsing when structured data unavailable
- System indicates confidence level or extraction success

**Extracted Data Elements:**

**Ingredients:**
- Raw ingredient text (e.g., "2 cups flour")
- Parsed components when possible:
  - Quantity (numeric)
  - Unit (cups, tablespoons, grams)
  - Ingredient name
  - Preparation notes (optional, e.g., "chopped", "diced")

**Steps:**
- Step number/order
- Instruction text
- Preserve step sequence

---

### FR-4: Structured Data Storage
**Priority:** Must Have
**Description:** All extracted data stored in flat-file JSON format on disk.

**Acceptance Criteria:**
- Each recipe stored as individual JSON file in designated directory
- Each recipe has unique identifier (used as filename)
- Metadata captured: source URL, extraction date, recipe title (if available)
- Data queryable by reading and parsing JSON files
- Data persists on file system
- File system operations compatible with shared hosting write permissions

**Storage Structure:**
```
/recipes/
  /data/
    {recipe-id}.json
    {recipe-id}.json
  index.json (optional: lightweight index for faster lookups)
```

---

### FR-5: Manual Recipe Tagging
**Priority:** Must Have
**Description:** Users can manually add, edit, and remove tags on saved recipes.

**Acceptance Criteria:**
- User can add multiple tags to a recipe (e.g., "vegan", "quick", "dinner", "italian")
- Tags stored as array of strings in recipe JSON
- Tags are case-insensitive and normalized (lowercase, trimmed)
- User can remove tags from recipes
- No limit on number of tags per recipe
- Common tags suggested based on existing recipes (optional UX enhancement)

---

### FR-6: Automatic Tag Suggestion
**Priority:** Should Have
**Description:** System automatically suggests or applies tags based on recipe content analysis.

**Acceptance Criteria:**
- System analyzes recipe title, ingredients, and instructions to suggest tags
- Auto-tagging rules include:
  - **Dietary:** Detect vegan (tofu, tempeh, no animal products), vegetarian, gluten-free, dairy-free
  - **Cuisine:** Detect italian (pasta, risotto), mexican (tacos, salsa), asian (soy sauce, ginger), indian (curry, naan)
  - **Meal Type:** Detect breakfast (eggs, pancakes), lunch, dinner, dessert (cake, cookies), snack
  - **Cooking Method:** Detect baked, grilled, fried, slow-cooker, instant-pot, no-bake
  - **Speed:** Detect quick (prep + cook time < 30 min), easy (few ingredients/steps)
  - **Main Ingredient:** Detect chicken, beef, pork, fish, seafood, pasta, rice
- Auto-suggested tags can be accepted or rejected by user
- System uses keyword matching and rules-based logic (no ML required)

**Auto-Tagging Rules Logic:**
```php
// Example rule structure
$rules = [
  'vegan' => ['tofu', 'tempeh', 'chickpeas', 'lentils'] // + no animal products
  'italian' => ['pasta', 'risotto', 'parmesan', 'basil', 'mozzarella']
  'quick' => // total time < 30 minutes
  'dessert' => ['sugar', 'chocolate', 'cake', 'cookie', 'frosting']
];
```

---

### FR-7: Measurement Conversion and Storage
**Priority:** Must Have
**Description:** System stores all measurements in metric units and converts from imperial when needed.

**Acceptance Criteria:**
- All ingredient quantities stored internally in metric (grams, ml, liters, kg)
- When extracting recipes with imperial units, system automatically converts to metric
- Conversion accuracy within 2% tolerance
- Support common conversions:
  - Volume: cups → ml, tablespoons → ml, teaspoons → ml, fluid oz → ml
  - Weight: ounces → grams, pounds → kg
  - Temperature: Fahrenheit → Celsius
- Preserve original unit in metadata for reference

**Conversion Reference:**
```
Volume:
- 1 cup = 240 ml
- 1 tablespoon = 15 ml
- 1 teaspoon = 5 ml
- 1 fluid oz = 30 ml

Weight:
- 1 oz = 28.35 grams
- 1 lb = 453.6 grams

Temperature:
- (F - 32) × 5/9 = C
```

---

### FR-8: Recipe Scaling
**Priority:** Should Have
**Description:** System can automatically recalculate ingredient quantities for different serving sizes.

**Acceptance Criteria:**
- User can specify scaling factor (e.g., 0.5x, 2x, 3x) or target serving count
- System multiplies all ingredient quantities by scaling factor
- System preserves measurement units after scaling
- System rounds scaled quantities to sensible precision (e.g., 47.3g → 47g, 1.87 cups → 2 cups)
- Scaling preserves original recipe; creates scaled view or copy

**Scaling Logic:**
```php
// Example: Original serves 4, user wants 6 servings
$scale_factor = 6 / 4; // = 1.5
$scaled_quantity = $original_quantity * $scale_factor;
```

---

### FR-9: Recipe Image
**Priority:** Should Have
**Description:** Extract the primary/hero image from the recipe page for illustration purposes.

**Acceptance Criteria:**
- System extracts the primary recipe image URL from the web page
- Image identification follows priority order:
  1. Schema.org `image` property (from structured data)
  2. Open Graph `og:image` meta tag
  3. Largest/most prominent image near recipe content (heuristic fallback)
- System stores the image URL (not the image file itself) in the recipe JSON
- Image URL is absolute (not relative)
- System does not download or store image files on disk
- Image displayed as illustration alongside the recipe in UI
- Graceful handling if no image found (field is null or absent)
- No error if image URL becomes invalid over time

**Technical Considerations:**
- Extract from JSON-LD structured data first
- Parse HTML meta tags for Open Graph data
- Heuristic: identify images within recipe content area, select largest by dimensions
- Validate URLs are well-formed before storing

---

### FR-10: Error Handling
**Priority:** Should Have
**Description:** System gracefully handles failure scenarios.

**Acceptance Criteria:**
- Clear error messages for invalid URLs
- Notification when extraction fails or returns low-quality data
- Logging of errors for debugging (to log file on disk)
- System remains stable after failed extraction attempts
- File system errors (write permissions, disk full) handled gracefully

---

## Non-Functional Requirements

### NFR-1: Performance
- Page fetch and extraction completes within 15 seconds for 95% of requests
- System can process recipes sequentially without memory leaks
- File read/write operations complete in <500ms
- Recipe listing/index generation completes in <2 seconds for up to 1000 recipes

### NFR-2: Reliability
- System handles malformed HTML gracefully using DOMDocument error suppression
- No data loss during extraction failures
- Consistent extraction results for same URL across multiple runs
- File writes are atomic (use temp file + rename pattern)

### NFR-3: Maintainability
- Code structured with clear separation: fetching, parsing, storage, conversion
- Extraction logic extensible for new recipe formats
- Configuration externalized (timeouts, retry limits, conversion factors)
- Auto-tagging rules stored in easily editable configuration file

### NFR-4: Data Quality
- Minimum 80% completeness on ingredient extraction (8/10 ingredients captured)
- Steps extracted in correct order 95% of the time
- No duplicate or malformed data in storage
- Measurement conversions accurate within 2% of actual values

### NFR-5: Usability
- Minimal user input required (just URL)
- Clear feedback on extraction status and results
- Human-readable JSON output format for verification
- Auto-suggested tags clearly distinguished from manual tags

### NFR-6: Hosting Compatibility
- System runs on shared hosting environment (Hostinger)
- No CLI access or cron jobs required
- No database server dependencies
- Compatible with standard PHP shared hosting configuration (PHP 7.4+)
- File system operations use only standard PHP functions

---

## Data Model & Schema

### Recipe Entity (JSON File Structure)
```json
{
  "id": "uuid",
  "url": "string (source URL)",
  "title": "string (optional)",
  "extractedAt": "timestamp",
  "servings": {
    "count": "integer (optional)",
    "unit": "string (optional, e.g., 'servings', 'portions')"
  },
  "image": {
    "url": "string (absolute URL to image, optional)",
    "source": "string (schema.org, og:image, heuristic — how it was found)"
  },
  "tags": {
    "manual": ["string", "string"],
    "auto": ["string", "string"],
    "rejected": ["string"]
  },
  "ingredients": [
    {
      "order": "integer",
      "rawText": "string (required, original text)",
      "quantity": "number (optional, in metric)",
      "unit": "string (optional, metric unit)",
      "ingredient": "string (optional)",
      "preparation": "string (optional)",
      "originalQuantity": "number (optional, if converted)",
      "originalUnit": "string (optional, if converted)"
    }
  ],
  "steps": [
    {
      "order": "integer (required)",
      "instruction": "string (required)"
    }
  ],
  "metadata": {
    "extractionMethod": "string (schema.org, heuristic, etc.)",
    "confidence": "string (high, medium, low)",
    "processingTimeMs": "integer",
    "lastModified": "timestamp"
  }
}
```

### Storage Implementation
**Flat-File JSON Storage:**
- Each recipe stored as `{uuid}.json` in `/recipes/data/` directory
- Optional `index.json` file for quick lookups (contains id, title, url, tags only)
- Index regenerated on write operations or on-demand
- No database server required
- Simple backup: copy entire recipes directory

**Benefits:**
- No database setup or management
- Compatible with shared hosting
- Easy to backup and migrate
- Human-readable for debugging
- Version control friendly

**File System Structure:**
```
/var/www/html/recipeextractor/
  /recipes/
    /data/
      550e8400-e29b-41d4-a716-446655440000.json
      662f9511-f30c-52e5-b827-557766551111.json
    index.json
  /logs/
    error.log
  /config/
    tagging-rules.json
    conversion-factors.json
```

---

## Technical Considerations

### Extraction Strategy
1. **Primary:** Check for Schema.org Recipe structured data (JSON-LD, microdata)
2. **Secondary:** Check for hRecipe microformat
3. **Fallback:** Heuristic parsing using common HTML patterns (ul/ol for ingredients, ordered lists for steps)

### Technology Stack

**Language & Runtime:**
- **PHP 7.4+** (compatible with Hostinger shared hosting)
- No framework required (vanilla PHP) or lightweight framework (Slim, Flight)

**HTTP Client:**
- **cURL** (PHP extension) for fetching pages
- Fallback to `file_get_contents()` with stream context if cURL unavailable

**HTML Parsing:**
- **DOMDocument** (built-in PHP) for HTML parsing
- **SimpleXMLElement** for XML/structured data extraction
- **json_decode()** for JSON-LD schema extraction

**Storage:**
- **Flat-file JSON** (standard PHP `file_put_contents()`, `file_get_contents()`)
- File locking (`LOCK_EX`) for concurrent write safety

**Auto-Tagging:**
- Rules-based keyword matching (no external libraries required)
- Configuration file (`tagging-rules.json`) with keyword → tag mappings

**Measurement Conversion:**
- Custom PHP conversion library/functions
- Configuration file (`conversion-factors.json`) with conversion ratios

**Hosting:**
- **Hostinger shared hosting** (PHP + file system access)
- Standard web hosting control panel (cPanel, hPanel)

### Measurement Conversion Implementation

**Conversion Logic:**
```php
class MeasurementConverter {
  private $conversions = [
    'cup' => ['ml' => 240],
    'tablespoon' => ['ml' => 15],
    'teaspoon' => ['ml' => 5],
    'fluid ounce' => ['ml' => 30],
    'ounce' => ['g' => 28.35],
    'pound' => ['g' => 453.6],
    // ... more conversions
  ];

  public function toMetric($quantity, $unit) {
    // Convert imperial to metric
  }

  public function scale($quantity, $factor) {
    // Scale recipe by factor
  }
}
```

### Auto-Tagging Implementation

**Tagging Rules Configuration (tagging-rules.json):**
```json
{
  "dietary": {
    "vegan": {
      "include_keywords": ["tofu", "tempeh", "chickpeas", "lentils"],
      "exclude_keywords": ["chicken", "beef", "pork", "fish", "egg", "milk", "cheese"]
    },
    "vegetarian": {
      "exclude_keywords": ["chicken", "beef", "pork", "fish", "meat"]
    },
    "gluten-free": {
      "exclude_keywords": ["flour", "wheat", "bread", "pasta"]
    }
  },
  "cuisine": {
    "italian": ["pasta", "risotto", "parmesan", "basil", "mozzarella"],
    "mexican": ["taco", "salsa", "tortilla", "cilantro", "lime"],
    "asian": ["soy sauce", "ginger", "sesame", "rice vinegar"]
  },
  "meal_type": {
    "breakfast": ["egg", "pancake", "waffle", "breakfast", "morning"],
    "dessert": ["sugar", "chocolate", "cake", "cookie", "frosting", "dessert"]
  }
}
```

**Tagging Engine:**
```php
class AutoTagger {
  public function suggestTags($recipe) {
    $tags = [];
    $text = strtolower($recipe['title'] . ' ' . implode(' ', $recipe['ingredients']));

    // Check each rule category
    foreach ($this->rules as $category => $rules) {
      foreach ($rules as $tag => $keywords) {
        if ($this->matchesKeywords($text, $keywords)) {
          $tags[] = $tag;
        }
      }
    }

    return $tags;
  }
}
```

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Website blocks scraping | High | Implement respectful User-Agent, rate limiting, robots.txt compliance |
| HTML structure varies widely | High | Multi-strategy extraction (structured data first, fallback to heuristics) |
| Extraction accuracy insufficient | Medium | Start with popular recipe sites with good markup; iterate on parser |
| Website requires JavaScript rendering | Medium | Document limitation; consider headless browser for v2 if needed |
| Measurement conversion errors | Medium | Comprehensive testing; use standard conversion factors; allow manual override |
| Auto-tagging produces irrelevant tags | Low | User can reject tags; improve rules based on feedback |
| File system performance degrades | Low | Implement simple index file; paginate listings; archive old recipes |
| Shared hosting limitations | Medium | Design for lowest common denominator; no CLI/cron dependencies |

---

## Dependencies & Assumptions

### Dependencies
- Internet connectivity for URL fetching
- Target websites remain accessible and don't block requests
- Recipe pages contain sufficient structure for extraction
- PHP 7.4+ with cURL extension available on hosting
- File system write permissions on hosting server

### Assumptions
- Single user environment (no authentication/multi-tenancy)
- Recipes are primarily in English (v1)
- Users have legitimate access to recipe URLs they submit
- Storage requirements modest (<10,000 recipes initially, ~50MB disk space)
- Shared hosting provides adequate PHP execution time (30+ seconds)
- File system performance adequate for JSON read/write operations

---

## Out of Scope (Explicitly)

The following are explicitly out of scope for v1:
- User interface for browsing/searching saved recipes
- Recipe editing beyond adding/removing tags
- Duplicate detection
- Video content processing
- PDF or document upload
- Nutrition information parsing
- Shopping list generation
- Multi-user support or sharing
- API for external integrations
- Mobile applications
- Browser extensions
- Meal planning features
- Recipe rating or reviews
- Recipe comments or notes

---

## Future Considerations (Post-v1)

These may be considered for future releases:
- Web UI for browsing saved recipes
- Search and filtering capabilities (by tag, ingredient, title)
- Recipe editing and annotation
- Duplicate detection and merging
- Export to PDF or other formats
- Browser extension for one-click saving
- Recipe rating and personal notes
- Ingredient-based search
- Nutrition information extraction
- Shopping list generation from multiple recipes
- Recipe collections/categories

---

## Open Questions

1. **Validation:** How should users verify extraction accuracy? Show preview before saving?
2. **Duplicates:** Should system prevent duplicate URLs from being saved?
3. **Updates:** If a recipe URL is re-submitted, should it update the existing record or create new?
4. **Failure Handling:** Should partially extracted recipes (e.g., ingredients but no steps) be saved?
5. **Batch Processing:** Will users want to submit multiple URLs at once?
6. **Tag Management:** Should there be a master tag list, or free-form tagging?
7. **Measurement Display:** Should UI show both metric and imperial, or metric only?
8. **Auto-Tag Application:** Should auto-suggested tags be automatically applied or require user approval?
9. **Scaling Persistence:** Should scaled versions be saved as new recipes or dynamically calculated?

---

## Success Criteria Checklist

Before considering this PRD complete and moving to implementation:
- [x] Problem statement validated with potential users
- [x] Functional requirements reviewed for completeness
- [x] Data schema validated as sufficient for core use cases
- [x] Technical feasibility confirmed (PHP libraries evaluated)
- [x] Success metrics defined and measurable
- [x] Out-of-scope items explicitly documented
- [x] Hosting constraints addressed (shared hosting compatibility)
- [x] Measurement conversion logic defined
- [x] Auto-tagging rules structure defined
- [ ] Open questions addressed or documented for later resolution

---

## Approval & Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Manager | | | Pending |
| Engineering Lead | | | Pending |
| Stakeholder | | | Pending |

---

## Appendix A: Example Recipe Extraction

**Input URL:** `https://example.com/chocolate-chip-cookies`

**Expected Output:**
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
    "url": "https://example.com/images/chocolate-chip-cookies-hero.jpg",
    "source": "schema.org"
  },
  "tags": {
    "manual": ["favorite"],
    "auto": ["dessert", "baked", "quick"],
    "rejected": []
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
    },
    {
      "order": 3,
      "rawText": "8 oz chocolate chips",
      "quantity": 227,
      "unit": "g",
      "ingredient": "chocolate chips",
      "preparation": null,
      "originalQuantity": 8,
      "originalUnit": "oz"
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
    },
    {
      "order": 3,
      "instruction": "Cream together butter and sugars until fluffy."
    }
  ],
  "metadata": {
    "extractionMethod": "schema.org",
    "confidence": "high",
    "processingTimeMs": 1250,
    "lastModified": "2026-02-26T10:30:00Z"
  }
}
```

---

## Appendix B: Reference Materials

- Schema.org Recipe specification: https://schema.org/Recipe
- hRecipe microformat: http://microformats.org/wiki/hrecipe
- PHP DOMDocument: https://www.php.net/manual/en/class.domdocument.php
- PHP cURL: https://www.php.net/manual/en/book.curl.php
- Measurement conversion standards: https://www.nist.gov/pml/weights-and-measures
- Hostinger PHP documentation: https://support.hostinger.com/en/articles/1583527-php-configuration

---

## Appendix C: Measurement Conversion Table

### Volume Conversions (to Metric)
| Imperial Unit | Metric Equivalent |
|---------------|-------------------|
| 1 cup | 240 ml |
| 1/2 cup | 120 ml |
| 1/4 cup | 60 ml |
| 1 tablespoon | 15 ml |
| 1 teaspoon | 5 ml |
| 1 fluid ounce | 30 ml |
| 1 pint | 473 ml |
| 1 quart | 946 ml |
| 1 gallon | 3.785 liters |

### Weight Conversions (to Metric)
| Imperial Unit | Metric Equivalent |
|---------------|-------------------|
| 1 ounce | 28.35 grams |
| 1 pound | 453.6 grams |

### Temperature Conversion
| Fahrenheit | Celsius |
|------------|---------|
| 250°F | 121°C |
| 300°F | 149°C |
| 350°F | 177°C |
| 375°F | 191°C |
| 400°F | 204°C |
| 425°F | 218°C |
| 450°F | 232°C |

---

**End of Document**
