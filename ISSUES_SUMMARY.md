# GitHub Issues Summary - Recipe Extractor

This document summarizes the 10 user stories created from the PRD at `/Users/areher/Documents/recipeextractor/PRD.md`.

## Execution Instructions

To create the GitHub repository and all issues, run:

```bash
chmod +x /Users/areher/Documents/recipeextractor/create-issues.sh
/Users/areher/Documents/recipeextractor/create-issues.sh
```

This will:
1. Create a public GitHub repository named `recipeextractor` (if not already created)
2. Link it to your local git repository
3. Create 10 GitHub issues (user stories) based on the PRD functional requirements

---

## User Stories Created

### Must-Have Stories (Priority 1)

#### Issue 1: Submit a recipe URL for extraction
**Maps to:** FR-1
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want to submit a URL pointing to a recipe web page, so that I can capture recipe data without manual copy-paste.

**Acceptance Criteria:**
- System accepts valid HTTP/HTTPS URLs
- System validates URL format before processing
- System provides feedback on submission status (success/failure)

---

#### Issue 2: Fetch recipe page content from submitted URL
**Maps to:** FR-2
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want the system to automatically fetch the content of the recipe URL I submitted, so that I don't have to manually download or copy HTML.

**Acceptance Criteria:**
- System successfully retrieves HTML content from valid URLs using cURL
- System handles common HTTP errors (404, 500, timeout)
- System follows redirects (up to 3 hops)
- System respects robots.txt and implements respectful rate limiting
- Timeout after 15 seconds to prevent hanging

**Technical Notes:**
- PHP cURL extension
- HTTPS certificate handling
- Retry logic (max 2 retries)
- Shared hosting compatible

---

#### Issue 3: Extract structured recipe data from page HTML
**Maps to:** FR-3
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want the system to automatically identify and extract ingredients and cooking steps from the recipe page, so that I have structured recipe data without manual reformatting.

**Acceptance Criteria:**
- System identifies and extracts ingredient list with quantities
- System identifies and extracts cooking/preparation steps in order
- System handles common recipe markup formats (Schema.org Recipe, hRecipe)
- System falls back to heuristic parsing when structured data unavailable
- System indicates confidence level or extraction success

**Extraction Strategy:**
1. Primary: Schema.org Recipe structured data (JSON-LD, microdata)
2. Secondary: hRecipe microformat
3. Fallback: Heuristic parsing using common HTML patterns

---

#### Issue 4: Store extracted recipes as JSON files on disk
**Maps to:** FR-4
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want all extracted recipe data stored in a consistent, queryable format, so that I can build a searchable personal recipe library that persists over time.

**Acceptance Criteria:**
- Each recipe stored as individual JSON file in designated directory
- Each recipe has unique identifier (used as filename)
- Metadata captured: source URL, extraction date, recipe title
- Data queryable by reading and parsing JSON files
- Data persists on file system
- File system operations compatible with shared hosting write permissions

**Storage Structure:**
```
/recipes/
  /data/
    {recipe-id}.json
  index.json (optional)
```

---

#### Issue 5: Manually add, edit, and remove tags on recipes
**Maps to:** FR-5
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want to manually add and manage tags on my saved recipes, so that I can organize and categorize recipes according to my personal system.

**Acceptance Criteria:**
- User can add multiple tags to a recipe (e.g., "vegan", "quick", "dinner", "italian")
- Tags stored as array of strings in recipe JSON
- Tags are case-insensitive and normalized (lowercase, trimmed)
- User can remove tags from recipes
- No limit on number of tags per recipe
- Common tags suggested based on existing recipes (optional UX enhancement)

---

#### Issue 7: Convert and store all measurements in metric units
**Maps to:** FR-7
**Labels:** enhancement, must-have
**Persona:** Alex - Home Cook Organizer (international recipes)

**User Story:**
As a home cook organizer who uses recipes from international sources, I want all ingredient measurements stored in metric units with automatic conversion from imperial, so that I have consistent measurements across my entire recipe collection.

**Acceptance Criteria:**
- All ingredient quantities stored internally in metric (grams, ml, liters, kg)
- When extracting recipes with imperial units, system automatically converts to metric
- Conversion accuracy within 2% tolerance
- Support volume conversions: cups → ml, tablespoons → ml, teaspoons → ml, fluid oz → ml
- Support weight conversions: ounces → grams, pounds → kg
- Support temperature conversions: Fahrenheit → Celsius
- Preserve original unit in metadata for reference

**Key Conversions:**
- 1 cup = 240 ml
- 1 tablespoon = 15 ml
- 1 teaspoon = 5 ml
- 1 fluid oz = 30 ml
- 1 oz = 28.35 grams
- 1 lb = 453.6 grams

---

### Should-Have Stories (Priority 2)

#### Issue 6: Automatically suggest tags based on recipe content
**Maps to:** FR-6
**Labels:** enhancement, should-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want the system to automatically suggest relevant tags based on the recipe content, so that I save time on categorization and discover useful organizational labels.

**Acceptance Criteria:**
- System analyzes recipe title, ingredients, and instructions to suggest tags
- Auto-tagging detects dietary tags (vegan, vegetarian, gluten-free, dairy-free)
- Auto-tagging detects cuisine tags (italian, mexican, asian, indian)
- Auto-tagging detects meal type tags (breakfast, lunch, dinner, dessert, snack)
- Auto-tagging detects cooking method tags (baked, grilled, fried, slow-cooker, instant-pot, no-bake)
- Auto-tagging detects speed/difficulty tags (quick, easy)
- Auto-tagging detects main ingredient tags (chicken, beef, pork, fish, seafood, pasta, rice)
- Auto-suggested tags can be accepted or rejected by user
- System uses keyword matching and rules-based logic (no ML required)

**Success Target:** 70%+ acceptance rate for auto-suggested tags

---

#### Issue 8: Scale recipe ingredient quantities for different serving sizes
**Maps to:** FR-8
**Labels:** enhancement, should-have
**Persona:** Jamie - Recipe Curator

**User Story:**
As a recipe curator who adjusts serving sizes frequently, I want to automatically recalculate ingredient quantities for different serving sizes, so that I don't have to manually do math when cooking for more or fewer people.

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

#### Issue 9: Extract primary recipe image from web page
**Maps to:** FR-9
**Labels:** enhancement, should-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want the system to extract the main recipe photo from the web page, so that I can visually identify recipes in my collection.

**Acceptance Criteria:**
- System extracts the primary recipe image URL from the web page
- Image identification follows priority order: Schema.org image property → Open Graph og:image → heuristic fallback
- System stores the image URL (not the image file itself) in the recipe JSON
- Image URL is absolute (not relative)
- System does not download or store image files on disk
- Image displayed as illustration alongside the recipe in UI
- Graceful handling if no image found (field is null or absent)
- No error if image URL becomes invalid over time

**Extraction Priority:**
1. Extract from JSON-LD structured data (Schema.org `image` property)
2. Parse HTML meta tags for Open Graph data (`og:image`)
3. Heuristic: identify images within recipe content area, select largest by dimensions

---

#### Issue 10: Gracefully handle extraction failures and errors
**Maps to:** FR-10
**Labels:** enhancement, should-have
**Persona:** Alex - Home Cook Organizer

**User Story:**
As a home cook organizer, I want clear error messages when recipe extraction fails, so that I understand what went wrong and can take appropriate action.

**Acceptance Criteria:**
- Clear error messages for invalid URLs
- Notification when extraction fails or returns low-quality data
- Logging of errors for debugging (to log file on disk)
- System remains stable after failed extraction attempts
- File system errors (write permissions, disk full) handled gracefully

**Error Scenarios:**
- Invalid URL format
- Network timeout
- HTTP errors (404, 500, etc.)
- Page contains no recognizable recipe data
- Extraction confidence too low
- File system write failures
- JSON encoding errors

---

## Story Mapping Overview

| Issue # | Title | PRD Ref | Priority | Persona |
|---------|-------|---------|----------|---------|
| 1 | Submit a recipe URL for extraction | FR-1 | Must Have | Alex |
| 2 | Fetch recipe page content from submitted URL | FR-2 | Must Have | Alex |
| 3 | Extract structured recipe data from page HTML | FR-3 | Must Have | Alex |
| 4 | Store extracted recipes as JSON files on disk | FR-4 | Must Have | Alex |
| 5 | Manually add, edit, and remove tags on recipes | FR-5 | Must Have | Alex |
| 6 | Automatically suggest tags based on recipe content | FR-6 | Should Have | Alex |
| 7 | Convert and store all measurements in metric units | FR-7 | Must Have | Alex |
| 8 | Scale recipe ingredient quantities for different serving sizes | FR-8 | Should Have | Jamie |
| 9 | Extract primary recipe image from web page | FR-9 | Should Have | Alex |
| 10 | Gracefully handle extraction failures and errors | FR-10 | Should Have | Alex |

---

## INVEST Compliance

Each story has been validated against the INVEST criteria:

- **Independent:** Each story can be implemented separately without strict dependencies
- **Negotiable:** Stories include technical notes but leave implementation details flexible
- **Valuable:** Each story delivers clear user value (stated in "so that" clause)
- **Estimable:** Stories have clear acceptance criteria and technical scope
- **Small:** Each story maps to a single functional requirement and is implementable in 1-2 sprints
- **Testable:** All acceptance criteria are concrete and verifiable

---

## Recommended Implementation Order

### Sprint 1: Core Extraction Pipeline (Must-Have)
1. Issue 1: URL Submission
2. Issue 2: Page Fetching
3. Issue 3: Recipe Extraction
4. Issue 4: Structured Data Storage

### Sprint 2: Data Enhancement (Must-Have)
5. Issue 7: Measurement Conversion
6. Issue 5: Manual Recipe Tagging

### Sprint 3: Intelligent Features (Should-Have)
7. Issue 6: Automatic Tag Suggestion
8. Issue 9: Recipe Image Extraction
9. Issue 10: Error Handling

### Sprint 4: User Experience (Should-Have)
10. Issue 8: Recipe Scaling

---

## Success Metrics by Story

| Story | Success Metric |
|-------|----------------|
| FR-1 | 100% valid URLs accepted, invalid URLs rejected with clear error |
| FR-2 | 95% of pages fetched within 15 seconds |
| FR-3 | 90%+ accuracy on ingredient and step extraction |
| FR-4 | 100% data persistence, no data loss |
| FR-5 | Users can manage tags in <5 seconds per operation |
| FR-6 | 70%+ auto-suggested tags accepted by users |
| FR-7 | 95%+ accuracy on unit conversion (within 2% tolerance) |
| FR-8 | Scaled quantities accurate and sensibly rounded |
| FR-9 | Primary image extracted for 80%+ of recipes |
| FR-10 | Zero system crashes, all errors logged and reported clearly |

---

## Next Steps

1. Run the `create-issues.sh` script to create the GitHub repository and issues
2. Review created issues in GitHub
3. Assign issues to sprints based on recommended implementation order
4. Begin development with Sprint 1 (Core Extraction Pipeline)
5. Use issue checkboxes to track acceptance criteria completion

---

**Generated:** 2026-02-26
**PRD Version:** 1.2
**Total Stories:** 10 (6 Must-Have, 4 Should-Have)
