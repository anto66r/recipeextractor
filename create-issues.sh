#!/bin/bash
set -e

cd /Users/areher/Documents/recipeextractor

# Create GitHub repository if remote doesn't exist
if ! git remote get-url origin &> /dev/null; then
  echo "Creating GitHub repository..."
  gh repo create recipeextractor --public --source=. --remote=origin --description="Recipe extraction tool that saves structured recipe data from URLs"

  # Initial commit if needed
  if [ -z "$(git log --oneline 2>/dev/null)" ]; then
    git add .
    git commit -m "Initial commit with PRD"
    git push -u origin main || git push -u origin master
  fi
fi

echo "Creating GitHub issues..."

# FR-1: URL Submission
gh issue create \
  --title "Submit a recipe URL for extraction" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer,
I want to submit a URL pointing to a recipe web page,
So that I can capture recipe data without manual copy-paste.

## Acceptance Criteria
- [ ] System accepts valid HTTP/HTTPS URLs
- [ ] System validates URL format before processing
- [ ] System provides feedback on submission status (success/failure)

## Technical Notes
- Use PHP URL validation functions
- Support both HTTP and HTTPS protocols
- Return clear error messages for invalid URLs

## Priority
Must Have

## Related
PRD: FR-1"

# FR-2: Page Fetching
gh issue create \
  --title "Fetch recipe page content from submitted URL" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer,
I want the system to automatically fetch the content of the recipe URL I submitted,
So that I don't have to manually download or copy HTML.

## Acceptance Criteria
- [ ] System successfully retrieves HTML content from valid URLs using cURL
- [ ] System handles common HTTP errors (404, 500, timeout)
- [ ] System follows redirects (up to 3 hops)
- [ ] System respects robots.txt and implements respectful rate limiting
- [ ] Timeout after 15 seconds to prevent hanging

## Technical Notes
- Use PHP cURL extension for HTTP requests
- Handle HTTPS certificates properly
- Set appropriate User-Agent header
- Implement retry logic for transient failures (max 2 retries)
- Compatible with shared hosting environment (no CLI/background jobs)
- Fallback to \`file_get_contents()\` with stream context if cURL unavailable

## Priority
Must Have

## Related
PRD: FR-2"

# FR-3: Recipe Extraction
gh issue create \
  --title "Extract structured recipe data from page HTML" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer,
I want the system to automatically identify and extract ingredients and cooking steps from the recipe page,
So that I have structured recipe data without manual reformatting.

## Acceptance Criteria
- [ ] System identifies and extracts ingredient list with quantities
- [ ] System identifies and extracts cooking/preparation steps in order
- [ ] System handles common recipe markup formats (Schema.org Recipe, hRecipe)
- [ ] System falls back to heuristic parsing when structured data unavailable
- [ ] System indicates confidence level or extraction success

## Extracted Data Elements

### Ingredients
- Raw ingredient text (e.g., \"2 cups flour\")
- Parsed components when possible:
  - Quantity (numeric)
  - Unit (cups, tablespoons, grams)
  - Ingredient name
  - Preparation notes (optional, e.g., \"chopped\", \"diced\")

### Steps
- Step number/order
- Instruction text
- Preserve step sequence

## Technical Notes
**Extraction Strategy:**
1. **Primary:** Check for Schema.org Recipe structured data (JSON-LD, microdata)
2. **Secondary:** Check for hRecipe microformat
3. **Fallback:** Heuristic parsing using common HTML patterns (ul/ol for ingredients, ordered lists for steps)

Use PHP DOMDocument for HTML parsing, SimpleXMLElement for XML/structured data, json_decode() for JSON-LD.

## Priority
Must Have

## Related
PRD: FR-3"

# FR-4: Structured Data Storage
gh issue create \
  --title "Store extracted recipes as JSON files on disk" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer,
I want all extracted recipe data stored in a consistent, queryable format,
So that I can build a searchable personal recipe library that persists over time.

## Acceptance Criteria
- [ ] Each recipe stored as individual JSON file in designated directory
- [ ] Each recipe has unique identifier (used as filename)
- [ ] Metadata captured: source URL, extraction date, recipe title (if available)
- [ ] Data queryable by reading and parsing JSON files
- [ ] Data persists on file system
- [ ] File system operations compatible with shared hosting write permissions

## Storage Structure
\`\`\`
/recipes/
  /data/
    {recipe-id}.json
    {recipe-id}.json
  index.json (optional: lightweight index for faster lookups)
\`\`\`

## JSON Schema
See PRD Appendix A for complete schema example.

## Technical Notes
- Use UUID or timestamp-based unique IDs for filenames
- Use atomic file writes (temp file + rename pattern) to prevent corruption
- Implement file locking (LOCK_EX) for concurrent write safety
- Store as pretty-printed JSON for human readability
- Validate JSON structure before writing

## Priority
Must Have

## Related
PRD: FR-4"

# FR-5: Manual Recipe Tagging
gh issue create \
  --title "Manually add, edit, and remove tags on recipes" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer,
I want to manually add and manage tags on my saved recipes,
So that I can organize and categorize recipes according to my personal system.

## Acceptance Criteria
- [ ] User can add multiple tags to a recipe (e.g., \"vegan\", \"quick\", \"dinner\", \"italian\")
- [ ] Tags stored as array of strings in recipe JSON
- [ ] Tags are case-insensitive and normalized (lowercase, trimmed)
- [ ] User can remove tags from recipes
- [ ] No limit on number of tags per recipe
- [ ] Common tags suggested based on existing recipes (optional UX enhancement)

## Technical Notes
- Store tags in separate \`manual\` array within recipe JSON
- Normalize tags: lowercase, trim whitespace, remove duplicates
- Tag management operations: add, remove, list
- Consider maintaining a global tag list for autocomplete/suggestions

## Priority
Must Have

## Related
PRD: FR-5"

# FR-6: Automatic Tag Suggestion
gh issue create \
  --title "Automatically suggest tags based on recipe content" \
  --label "enhancement,should-have" \
  --body "## User Story
As a home cook organizer,
I want the system to automatically suggest relevant tags based on the recipe content,
So that I save time on categorization and discover useful organizational labels.

## Acceptance Criteria
- [ ] System analyzes recipe title, ingredients, and instructions to suggest tags
- [ ] Auto-tagging detects dietary tags (vegan, vegetarian, gluten-free, dairy-free)
- [ ] Auto-tagging detects cuisine tags (italian, mexican, asian, indian)
- [ ] Auto-tagging detects meal type tags (breakfast, lunch, dinner, dessert, snack)
- [ ] Auto-tagging detects cooking method tags (baked, grilled, fried, slow-cooker, instant-pot, no-bake)
- [ ] Auto-tagging detects speed/difficulty tags (quick, easy)
- [ ] Auto-tagging detects main ingredient tags (chicken, beef, pork, fish, seafood, pasta, rice)
- [ ] Auto-suggested tags can be accepted or rejected by user
- [ ] System uses keyword matching and rules-based logic (no ML required)

## Auto-Tagging Rules Logic
- Store rules in configuration file (\`tagging-rules.json\`)
- Use keyword matching against combined text (title + ingredients + steps)
- Support both include and exclude keywords (e.g., vegan requires tofu/tempeh AND no animal products)
- See PRD Section FR-6 and Technical Considerations for detailed rule structure

## Technical Notes
- Rules-based keyword matching engine
- Configuration-driven (no hardcoded rules)
- Store auto-suggested tags in separate \`auto\` array
- Store rejected tags in \`rejected\` array
- 70%+ acceptance rate target for suggested tags

## Priority
Should Have

## Related
PRD: FR-6"

# FR-7: Measurement Conversion
gh issue create \
  --title "Convert and store all measurements in metric units" \
  --label "enhancement,must-have" \
  --body "## User Story
As a home cook organizer who uses recipes from international sources,
I want all ingredient measurements stored in metric units with automatic conversion from imperial,
So that I have consistent measurements across my entire recipe collection.

## Acceptance Criteria
- [ ] All ingredient quantities stored internally in metric (grams, ml, liters, kg)
- [ ] When extracting recipes with imperial units, system automatically converts to metric
- [ ] Conversion accuracy within 2% tolerance
- [ ] Support volume conversions: cups → ml, tablespoons → ml, teaspoons → ml, fluid oz → ml
- [ ] Support weight conversions: ounces → grams, pounds → kg
- [ ] Support temperature conversions: Fahrenheit → Celsius
- [ ] Preserve original unit in metadata for reference

## Conversion Reference
See PRD Appendix C for complete conversion table.

### Key Conversions
- 1 cup = 240 ml
- 1 tablespoon = 15 ml
- 1 teaspoon = 5 ml
- 1 fluid oz = 30 ml
- 1 oz = 28.35 grams
- 1 lb = 453.6 grams
- (F - 32) × 5/9 = C

## Technical Notes
- Create MeasurementConverter class/module
- Store conversion factors in configuration file (\`conversion-factors.json\`)
- Store both converted (metric) and original values in recipe JSON
- Handle fractional quantities (1/2 cup, 1 1/4 cups)
- Round to sensible precision (avoid 240.0000001 ml)

## Priority
Must Have

## Related
PRD: FR-7"

# FR-8: Recipe Scaling
gh issue create \
  --title "Scale recipe ingredient quantities for different serving sizes" \
  --label "enhancement,should-have" \
  --body "## User Story
As a recipe curator who adjusts serving sizes frequently,
I want to automatically recalculate ingredient quantities for different serving sizes,
So that I don't have to manually do math when cooking for more or fewer people.

## Acceptance Criteria
- [ ] User can specify scaling factor (e.g., 0.5x, 2x, 3x) or target serving count
- [ ] System multiplies all ingredient quantities by scaling factor
- [ ] System preserves measurement units after scaling
- [ ] System rounds scaled quantities to sensible precision (e.g., 47.3g → 47g, 1.87 cups → 2 cups)
- [ ] Scaling preserves original recipe; creates scaled view or copy

## Scaling Logic
\`\`\`php
// Example: Original serves 4, user wants 6 servings
\$scale_factor = 6 / 4; // = 1.5
\$scaled_quantity = \$original_quantity * \$scale_factor;
\`\`\`

## Technical Notes
- Accept both scaling factor (2x) and target servings (\"serves 6\")
- Calculate factor from original servings if provided
- Apply smart rounding (whole numbers for small quantities, decimals for large)
- Option to generate scaled copy or dynamic view (recommend dynamic for v1)
- Preserve original recipe data unchanged

## Priority
Should Have

## Related
PRD: FR-8"

# FR-9: Recipe Image Extraction
gh issue create \
  --title "Extract primary recipe image from web page" \
  --label "enhancement,should-have" \
  --body "## User Story
As a home cook organizer,
I want the system to extract the main recipe photo from the web page,
So that I can visually identify recipes in my collection.

## Acceptance Criteria
- [ ] System extracts the primary recipe image URL from the web page
- [ ] Image identification follows priority order: Schema.org image property → Open Graph og:image → heuristic fallback (largest image near content)
- [ ] System stores the image URL (not the image file itself) in the recipe JSON
- [ ] Image URL is absolute (not relative)
- [ ] System does not download or store image files on disk
- [ ] Image displayed as illustration alongside the recipe in UI
- [ ] Graceful handling if no image found (field is null or absent)
- [ ] No error if image URL becomes invalid over time

## Technical Notes
**Extraction Priority:**
1. Extract from JSON-LD structured data (Schema.org \`image\` property)
2. Parse HTML meta tags for Open Graph data (\`og:image\`)
3. Heuristic: identify images within recipe content area, select largest by dimensions

- Validate URLs are well-formed before storing
- Convert relative URLs to absolute using base URL
- Store image source method in metadata (\"schema.org\", \"og:image\", \"heuristic\")

## Priority
Should Have

## Related
PRD: FR-9"

# FR-10: Error Handling
gh issue create \
  --title "Gracefully handle extraction failures and errors" \
  --label "enhancement,should-have" \
  --body "## User Story
As a home cook organizer,
I want clear error messages when recipe extraction fails,
So that I understand what went wrong and can take appropriate action.

## Acceptance Criteria
- [ ] Clear error messages for invalid URLs
- [ ] Notification when extraction fails or returns low-quality data
- [ ] Logging of errors for debugging (to log file on disk)
- [ ] System remains stable after failed extraction attempts
- [ ] File system errors (write permissions, disk full) handled gracefully

## Error Scenarios
- Invalid URL format
- Network timeout
- HTTP errors (404, 500, etc.)
- Page contains no recognizable recipe data
- Extraction confidence too low
- File system write failures
- JSON encoding errors

## Technical Notes
- Log all errors to \`/logs/error.log\` with timestamp
- Return user-friendly error messages (not technical stack traces)
- Implement graceful degradation (e.g., save partial data with warning)
- Use PHP error suppression for DOMDocument HTML parsing warnings
- Validate data quality before saving
- Never leave corrupted JSON files on disk

## Priority
Should Have

## Related
PRD: FR-10"

echo ""
echo "All issues created successfully!"
echo ""
echo "Listing issues:"
gh issue list
