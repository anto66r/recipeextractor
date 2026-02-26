# ADR-004: Store All Measurements in Metric Units

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** System Architect
**Context:** Recipe Extractor measurement standardization

---

## Context and Problem Statement

Recipe web pages use different measurement systems (imperial vs metric). When extracting ingredient quantities, we must decide how to store measurements to enable:

1. **Consistent storage** - Uniform format across all recipes
2. **Recipe scaling** - Multiply quantities by scaling factor
3. **Measurement conversion** - Convert between systems if needed
4. **International support** - Support recipes from any country

We must choose between:

1. **Store in original units** (preserve as-is from source)
2. **Store in metric** (convert imperial → metric on extraction)
3. **Store in imperial** (convert metric → imperial on extraction)
4. **Store both** (duplicate storage for each measurement)

---

## Decision Drivers

1. **International standard** - Metric is used by most countries
2. **Scientific precision** - Metric more precise, decimal-based
3. **Consistent calculations** - Single unit system simplifies scaling
4. **User preference** - Primary user (Alex) uses international recipes
5. **Future-proofing** - Metric is global standard
6. **Storage efficiency** - Single representation preferred
7. **Preserve original** - Keep source data for reference

---

## Considered Options

### Option 1: Store in Original Units

**Strategy:** Store measurements exactly as found on source page (no conversion).

**Pros:**
- Preserves original data (no conversion errors)
- Simple implementation (no conversion logic)
- Faithful to source

**Cons:**
- **Inconsistent storage** - Some recipes in cups, others in ml
- **Complex scaling** - Must handle multiple unit systems
- **Hard to compare** - Can't easily compare quantities across recipes
- **Mixed unit math** - Scaling requires unit-aware calculations

**Decision:** **REJECTED** - Inconsistency makes scaling and comparison difficult.

---

### Option 2: Store in Metric (Selected)

**Strategy:** Convert all quantities to metric units on extraction. Preserve original values separately.

**Pros:**
- **Consistent storage** - All recipes use same unit system
- **Simple scaling** - Multiply by factor, units stay same
- **International standard** - Metric used by most countries
- **Precise calculations** - Decimal-based (no 1/8 cup fractions)
- **Easy comparison** - Can compare quantities across recipes
- **Original preserved** - Keep source units in separate field

**Cons:**
- Conversion logic required (adds complexity)
- Small conversion errors possible (rounding)
- Extra storage for original values

**Decision:** **ACCEPTED** - Best balance of consistency and usability.

---

### Option 3: Store in Imperial

**Strategy:** Convert all quantities to imperial units (cups, ounces, tablespoons).

**Pros:**
- Common in US recipes
- Familiar to US users

**Cons:**
- **Not international standard** - Only US uses imperial
- **Fractional math** - Hard to work with (1/3 cup, 5/8 teaspoon)
- **Less precise** - Fractions harder than decimals
- **Not scientific standard** - Metric is global standard
- **User preference** - Primary user uses international recipes

**Decision:** **REJECTED** - Not international standard, less precise.

---

### Option 4: Store Both (Dual Storage)

**Strategy:** Store both metric and imperial values for every measurement.

**Pros:**
- Supports both user preferences
- No conversion needed for display
- Original preserved

**Cons:**
- **Duplicate storage** - Twice the data
- **Conversion still required** - Must convert on extraction
- **Consistency risk** - Two values may drift out of sync
- **Complex scaling** - Must scale both values
- **Overkill** - Not needed for single-user tool

**Decision:** **REJECTED** - Unnecessary complexity and duplication.

---

## Decision Outcome

**Chosen Option:** **Store in Metric with Original Preservation**

**Rationale:**
- **Consistency** - All recipes in same unit system (simplifies scaling, comparison)
- **International standard** - Metric used globally (aligns with user needs)
- **Precision** - Decimal-based calculations easier than fractions
- **Original preserved** - Keep source units in `originalUnit` and `originalQuantity` fields
- **Future-proof** - Metric is global standard

---

## Implementation Details

### Metric Units Used

**Volume:**
- Milliliters (ml) - for quantities < 1 liter
- Liters (l) - for quantities ≥ 1 liter

**Weight:**
- Grams (g) - for quantities < 1 kg
- Kilograms (kg) - for quantities ≥ 1 kg

**Temperature:**
- Celsius (°C)

### Conversion Factors

**Volume Conversions (Imperial → Metric):**

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
| 1 gallon | 3785 ml (3.785 l) |

**Weight Conversions (Imperial → Metric):**

| Imperial Unit | Metric Equivalent |
|---------------|-------------------|
| 1 ounce | 28.35 g |
| 1 pound | 453.6 g |

**Temperature Conversion:**
```
Celsius = (Fahrenheit - 32) × 5 / 9
```

### Storage Schema

**Ingredient Object:**

```json
{
  "order": 1,
  "rawText": "2 cups all-purpose flour",
  "quantity": 480,
  "unit": "ml",
  "ingredient": "all-purpose flour",
  "preparation": null,
  "originalQuantity": 2,
  "originalUnit": "cups"
}
```

**Fields:**
- `quantity` (float) - **Metric value** (stored)
- `unit` (string) - **Metric unit** (ml, g, kg, l)
- `originalQuantity` (float, optional) - Original value from source (if converted)
- `originalUnit` (string, optional) - Original unit from source (if converted)
- `rawText` (string) - Original text from source page (always preserved)

### Conversion Implementation

**MeasurementConverter.php:**

```php
class MeasurementConverter {
    private $conversionFactors;

    public function __construct() {
        // Load from config/conversion-factors.json
        $this->conversionFactors = $this->loadConversionFactors();
    }

    public function convertToMetric(float $quantity, string $unit): array {
        $normalized = $this->normalizeUnit($unit);  // "cup" or "cups" → "cup"

        if ($this->isMetric($normalized)) {
            // Already metric, no conversion
            return [
                'quantity' => $quantity,
                'unit' => $normalized,
                'originalQuantity' => null,
                'originalUnit' => null
            ];
        }

        if (!isset($this->conversionFactors[$normalized])) {
            // Unknown unit, store as-is with warning
            return [
                'quantity' => $quantity,
                'unit' => $normalized,
                'originalQuantity' => null,
                'originalUnit' => null,
                'warning' => 'Unknown unit, no conversion applied'
            ];
        }

        $factor = $this->conversionFactors[$normalized];
        $metricQuantity = $quantity * $factor['multiplier'];
        $metricUnit = $factor['metric_unit'];

        return [
            'quantity' => round($metricQuantity, 2),
            'unit' => $metricUnit,
            'originalQuantity' => $quantity,
            'originalUnit' => $unit
        ];
    }

    private function normalizeUnit(string $unit): string {
        // Normalize variations: "cup", "cups", "Cup" → "cup"
        $unit = strtolower(trim($unit));
        $unit = rtrim($unit, 's');  // Remove plural
        return $unit;
    }

    private function isMetric(string $unit): bool {
        return in_array($unit, ['ml', 'l', 'g', 'kg', 'liter', 'gram']);
    }

    private function loadConversionFactors(): array {
        $json = file_get_contents(CONFIG_PATH . '/conversion-factors.json');
        return json_decode($json, true);
    }
}
```

**Conversion Config (`config/conversion-factors.json`):**

```json
{
  "cup": { "multiplier": 240, "metric_unit": "ml" },
  "tablespoon": { "multiplier": 15, "metric_unit": "ml" },
  "teaspoon": { "multiplier": 5, "metric_unit": "ml" },
  "fluid_ounce": { "multiplier": 30, "metric_unit": "ml" },
  "pint": { "multiplier": 473, "metric_unit": "ml" },
  "quart": { "multiplier": 946, "metric_unit": "ml" },
  "gallon": { "multiplier": 3.785, "metric_unit": "l" },
  "ounce": { "multiplier": 28.35, "metric_unit": "g" },
  "pound": { "multiplier": 453.6, "metric_unit": "g" }
}
```

### Conversion Timing

**When:** Convert **during extraction**, before storage.

**Flow:**
```
Extract ingredient text ("2 cups flour")
  ↓
Parse quantity and unit (2, "cups")
  ↓
Convert to metric (480, "ml")
  ↓
Store with original values preserved
  ↓
Save to JSON file
```

### Handling Edge Cases

**1. Unknown Units:**
```json
{
  "rawText": "1 handful of spinach",
  "quantity": 1,
  "unit": "handful",
  "ingredient": "spinach",
  "originalQuantity": null,
  "originalUnit": null,
  "warning": "Unknown unit, no conversion applied"
}
```

**2. Unit-less Quantities:**
```json
{
  "rawText": "3 eggs",
  "quantity": 3,
  "unit": "count",
  "ingredient": "eggs",
  "originalQuantity": null,
  "originalUnit": null
}
```

**3. Already Metric:**
```json
{
  "rawText": "500g flour",
  "quantity": 500,
  "unit": "g",
  "ingredient": "flour",
  "originalQuantity": null,
  "originalUnit": null
}
```

---

## Consequences

### Positive Consequences

- **Consistent storage** - All recipes in same unit system
- **Simple scaling** - Multiply quantities without unit conversion
- **International support** - Metric is global standard
- **Precise calculations** - Decimal-based math (no fractions)
- **Easy comparison** - Can compare quantities across recipes
- **Original preserved** - Source data kept for reference
- **Future-proof** - Aligns with international standard

### Negative Consequences

- **Conversion logic required** - Adds implementation complexity
- **Rounding errors** - Small precision loss (acceptable: 2% tolerance)
- **Extra storage** - Original values stored separately
- **US user friction** - US users more familiar with imperial (mitigated: can display both)

### Mitigation Strategies

1. **Conversion Accuracy:**
   - Use standard conversion factors (NIST/international standards)
   - Round to 2 decimal places (sufficient precision for recipes)
   - Test conversions against known values

2. **Unknown Units:**
   - Store as-is with warning flag
   - Log unknown units for future support
   - Allow manual correction

3. **User Display:**
   - Show both metric and original in UI (if original exists)
   - Allow user preference for display units (future enhancement)

4. **Testing:**
   - Unit test all conversion factors
   - Test edge cases (fractions, unknown units, already metric)
   - Compare conversions against reference tables

---

## Recipe Scaling Impact

Metric storage simplifies scaling:

**Example: Scale recipe 1.5x**

```php
// Original (stored in metric)
$ingredient = [
    'quantity' => 240,
    'unit' => 'ml',
    'ingredient' => 'milk',
    'originalQuantity' => 1,
    'originalUnit' => 'cup'
];

// Scaled
$scaledIngredient = [
    'quantity' => 240 * 1.5,  // = 360 ml
    'unit' => 'ml',
    'ingredient' => 'milk',
    'originalQuantity' => 1 * 1.5,  // = 1.5 cups
    'originalUnit' => 'cup'
];
```

No unit conversion needed during scaling—just multiply quantities.

---

## Display Options (Future Enhancement)

Allow users to choose display preference:

**Metric Display:**
```
480 ml all-purpose flour
```

**Imperial Display:**
```
2 cups all-purpose flour
```

**Both:**
```
480 ml (2 cups) all-purpose flour
```

**Implementation:** Convert metric → imperial on display (reverse conversion).

---

## Related Decisions

- ADR-003: Multi-Strategy Extraction (conversion happens after extraction)
- ADR-001: Flat-File JSON Storage (store converted values in JSON)

---

## References

- NIST Measurement Standards: https://www.nist.gov/pml/weights-and-measures
- Metric Conversion Tables: https://www.convertunits.com/
- Schema.org Recipe Units: https://schema.org/Recipe
- Cooking Measurement Standards: https://en.wikipedia.org/wiki/Cooking_weights_and_measures

---

**Status:** Accepted
**Last Reviewed:** 2026-02-26
**Next Review:** After Sprint 2 completion (validate conversion accuracy)
