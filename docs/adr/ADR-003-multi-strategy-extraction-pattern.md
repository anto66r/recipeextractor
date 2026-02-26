# ADR-003: Multi-Strategy Extraction Pattern

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** System Architect
**Context:** Recipe Extractor parsing strategy

---

## Context and Problem Statement

Recipe web pages have highly variable HTML structure and markup. We need a strategy to extract structured recipe data (ingredients, steps, title) from diverse websites with varying markup approaches.

We must choose between:

1. **Single parsing strategy** (only Schema.org, or only heuristic)
2. **Multi-strategy with priority order** (try structured data first, fall back to heuristics)
3. **Site-specific extractors** (custom parser per website)
4. **Machine learning approach** (train model to identify recipe elements)

The solution must maximize extraction success rate, provide confidence levels, and work within PHP shared hosting constraints.

---

## Decision Drivers

1. **Success rate** - Extract recipes from as many sites as possible
2. **Reliability** - Structured data more reliable than heuristics
3. **Graceful degradation** - Fall back to less reliable methods if structured data unavailable
4. **Transparency** - Users should know extraction confidence
5. **Maintainability** - Easy to add new extraction strategies
6. **No external dependencies** - Works with PHP standard library only
7. **Performance** - Complete extraction within 15-30 seconds

---

## Considered Options

### Option 1: Schema.org Only

**Strategy:** Only extract from Schema.org Recipe structured data (JSON-LD, microdata).

**Pros:**
- Most reliable (structured, machine-readable)
- Clear data mapping
- Simple implementation
- High confidence

**Cons:**
- **Limited coverage** - Many sites don't use Schema.org
- **Low success rate** - Fail on sites without structured markup
- No fallback for older or non-compliant sites

**Decision:** **REJECTED** - Too limited, would fail on many sites.

---

### Option 2: Heuristic Only

**Strategy:** Always use heuristic HTML parsing (look for `<ul>` lists, common keywords).

**Pros:**
- Works on any site (even without markup)
- Flexible
- No dependency on structured data

**Cons:**
- **Low reliability** - HTML structure varies wildly
- **High false positive rate** - May extract wrong content
- **Low confidence** - Hard to know if extraction is correct
- Hard to maintain (endless edge cases)

**Decision:** **REJECTED** - Too unreliable as primary strategy.

---

### Option 3: Multi-Strategy with Priority (Selected)

**Strategy:** Try extraction strategies in priority order:
1. **Schema.org** (JSON-LD, microdata) - Most reliable
2. **hRecipe microformat** - Moderately reliable
3. **Heuristic parsing** - Least reliable, fallback only

Stop at first successful extraction.

**Pros:**
- **Maximizes success rate** (covers widest range of sites)
- **Optimizes reliability** (prefer structured data, fall back to heuristics)
- **Provides confidence levels** (based on which strategy succeeded)
- **Graceful degradation** (always try to extract something)
- **Maintainable** (each strategy is separate class)
- **Extensible** (easy to add new strategies)

**Cons:**
- More complex implementation (multiple extractor classes)
- Slightly slower (must try multiple strategies)
- Heuristic fallback may produce low-quality results

**Decision:** **ACCEPTED** - Best balance of success rate and reliability.

---

### Option 4: Site-Specific Extractors

**Strategy:** Custom extractor for each popular recipe site (AllRecipes.com, FoodNetwork.com, etc.).

**Pros:**
- Highest reliability for supported sites
- Can handle site-specific quirks
- High extraction quality

**Cons:**
- **High maintenance burden** - Sites change HTML frequently
- **Limited coverage** - Only works for known sites
- **Brittle** - Breaks when sites update
- Not scalable (can't cover all recipe sites)

**Decision:** **REJECTED** - Too brittle and maintenance-heavy.

---

### Option 5: Machine Learning

**Strategy:** Train ML model to identify recipe elements in HTML.

**Pros:**
- Could generalize to any site
- Adapts to new patterns

**Cons:**
- **Requires training data** (thousands of labeled recipes)
- **Complex infrastructure** (ML model hosting, inference)
- **Not feasible on shared hosting** (resource constraints)
- **Overkill** for personal tool
- Hard to debug and maintain

**Decision:** **REJECTED** - Too complex, not feasible on shared hosting.

---

## Decision Outcome

**Chosen Option:** **Multi-Strategy Extraction with Priority Order**

**Rationale:**
- Maximizes success rate by trying multiple approaches
- Prioritizes reliability (structured data first)
- Provides transparency (confidence levels based on method)
- Maintainable (each strategy is separate, testable class)
- Extensible (easy to add new strategies in future)

---

## Implementation Details

### Extraction Strategy Priority

```
1. SchemaOrgExtractor     (High confidence)
   - JSON-LD: <script type="application/ld+json">
   - Microdata: itemtype="https://schema.org/Recipe"

2. HRecipeExtractor       (Medium confidence)
   - hRecipe microformat: class="hrecipe"

3. HeuristicExtractor     (Low confidence)
   - Keyword-based HTML parsing
   - Look for "ingredients", "directions", "instructions"
   - Find <ul> or <ol> lists near keywords
```

### Orchestrator Pattern

**RecipeExtractor.php** (main orchestrator):

```php
class RecipeExtractor {
    private $extractors = [];

    public function __construct() {
        // Priority order matters
        $this->extractors = [
            new SchemaOrgExtractor(),
            new HRecipeExtractor(),
            new HeuristicExtractor()
        ];
    }

    public function extract(string $html, string $url): ?array {
        $dom = $this->loadHtml($html);

        foreach ($this->extractors as $extractor) {
            if ($extractor->canExtract($dom)) {
                $data = $extractor->extract($dom);

                if ($this->isValidRecipe($data)) {
                    return [
                        'recipe' => $data,
                        'confidence' => $extractor->getConfidenceLevel(),
                        'method' => $extractor->getName()
                    ];
                }
            }
        }

        // All extractors failed
        return null;
    }

    private function isValidRecipe(array $data): bool {
        // Validation: must have title or ingredients or steps
        return !empty($data['title']) ||
               !empty($data['ingredients']) ||
               !empty($data['steps']);
    }
}
```

### Extractor Interface

All extractors implement common interface:

```php
interface ExtractorInterface {
    public function canExtract(DOMDocument $dom): bool;
    public function extract(DOMDocument $dom): ?array;
    public function getConfidenceLevel(): string;  // "high", "medium", "low"
    public function getName(): string;  // "schema.org", "hrecipe", "heuristic"
}
```

### Confidence Levels

**High Confidence (Schema.org):**
- Data from JSON-LD or microdata
- Structured, machine-readable
- Clear field mappings
- Confidence: 90-100%

**Medium Confidence (hRecipe):**
- Data from hRecipe microformat
- Semi-structured (class-based markup)
- May have missing fields
- Confidence: 60-80%

**Low Confidence (Heuristic):**
- Data from keyword-based HTML parsing
- Unstructured, best-guess extraction
- High risk of false positives
- Confidence: 30-60%

### Confidence Calculation

Each extractor calculates confidence based on data completeness:

```php
private function calculateConfidence(array $data): float {
    $score = 0;
    $maxScore = 0;

    // Title
    $maxScore += 10;
    if (!empty($data['title'])) $score += 10;

    // Ingredients
    $maxScore += 40;
    if (!empty($data['ingredients'])) {
        $count = count($data['ingredients']);
        $score += min(40, $count * 5);  // 5 points per ingredient, max 40
    }

    // Steps
    $maxScore += 40;
    if (!empty($data['steps'])) {
        $count = count($data['steps']);
        $score += min(40, $count * 8);  // 8 points per step, max 40
    }

    // Image
    $maxScore += 10;
    if (!empty($data['image'])) $score += 10;

    return $score / $maxScore;  // 0.0 to 1.0
}
```

---

## Consequences

### Positive Consequences

- **High success rate** - Extracts from sites with any level of markup
- **Reliable when possible** - Prefers structured data (high quality)
- **Graceful degradation** - Falls back to heuristics (still tries)
- **Transparent confidence** - Users know extraction quality
- **Maintainable** - Each strategy is separate, testable class
- **Extensible** - Easy to add new strategies (e.g., OpenGraph, Twitter Cards)

### Negative Consequences

- **Complexity** - Multiple extractor classes to maintain
- **Performance** - Must try strategies sequentially (adds latency)
- **Heuristic limitations** - Low-quality results from fallback strategy
- **False positives** - Heuristic may extract wrong content

### Mitigation Strategies

1. **Complexity:**
   - Clear interface for all extractors
   - Each extractor is independent, testable
   - Good documentation for each strategy

2. **Performance:**
   - Stop at first successful extraction (don't try all)
   - Use `canExtract()` quick check before full extraction
   - Set reasonable timeout (15 seconds total)

3. **Heuristic Limitations:**
   - Show confidence level to users
   - Allow manual review/editing of extracted data
   - Provide "report issue" feedback for bad extractions

4. **False Positives:**
   - Implement validation rules (minimum ingredients/steps)
   - Score confidence based on data completeness
   - Warn users when confidence is low (<50%)

---

## Future Extensions

### Possible New Strategies (Priority Order)

1. **OpenGraph Metadata** (for image, description)
2. **Twitter Card Metadata** (for image, description)
3. **RDFa Markup** (for semantic data)
4. **Common Recipe Plugins** (WordPress recipe plugins have common structure)
5. **Site-Specific Extractors** (for frequently used sites, if heuristic fails)

### Adding New Strategy

Simple process:

1. Create new class implementing `ExtractorInterface`
2. Add to `RecipeExtractor` constructor in desired priority position
3. Test independently
4. Deploy

---

## Testing Strategy

### Unit Tests for Each Extractor

```php
// tests/SchemaOrgExtractorTest.php
class SchemaOrgExtractorTest {
    public function testExtractsJsonLd() {
        $html = '<script type="application/ld+json">{"@type":"Recipe",...}</script>';
        $extractor = new SchemaOrgExtractor();
        $dom = loadHtml($html);

        $this->assertTrue($extractor->canExtract($dom));
        $data = $extractor->extract($dom);
        $this->assertNotNull($data);
        $this->assertEquals('high', $extractor->getConfidenceLevel());
    }
}
```

### Integration Tests

Test full extraction flow with sample HTML from real recipe sites:

```php
// tests/RecipeExtractorIntegrationTest.php
class RecipeExtractorIntegrationTest {
    public function testExtractsFromSchemaOrgSite() {
        $html = file_get_contents('tests/fixtures/allrecipes-chocolate-chip-cookies.html');
        $extractor = new RecipeExtractor();
        $result = $extractor->extract($html, 'https://example.com');

        $this->assertNotNull($result);
        $this->assertEquals('high', $result['confidence']);
        $this->assertEquals('schema.org', $result['method']);
    }
}
```

---

## Related Decisions

- ADR-002: Vanilla PHP (custom extractor implementation, no framework)
- ADR-004: Store All Measurements in Metric (conversion happens after extraction)

---

## References

- Schema.org Recipe: https://schema.org/Recipe
- hRecipe Microformat: http://microformats.org/wiki/hrecipe
- JSON-LD Specification: https://json-ld.org/
- PHP DOMDocument: https://www.php.net/manual/en/class.domdocument.php

---

**Status:** Accepted
**Last Reviewed:** 2026-02-26
**Next Review:** After Sprint 1 completion (reassess extraction success rate)
