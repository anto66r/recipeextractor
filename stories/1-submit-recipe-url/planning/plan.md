# Strategic Implementation Plan: FR-1 - URL Submission for Extraction

## Executive Summary

FR-1 is the foundational story that establishes the entire application structure. This is not just about building a URL input form - it's about creating the skeleton of the entire architecture, establishing patterns that all future stories will follow, and proving the end-to-end flow on shared hosting.

## Current State Analysis

**Codebase Status:**
- Empty repository with comprehensive documentation
- No `/src/`, `/public/`, `/config/`, `/recipes/`, or `/logs/` directories exist
- Architecture decisions documented in ADRs
- SYSTEM_ARCHITECTURE.md provides detailed component design
- PRD defines clear acceptance criteria

**Key Architectural Constraints:**
- Vanilla PHP 7.4+ (no framework, no Composer)
- Flat-file JSON storage
- Shared hosting (Hostinger) compatibility
- Atomic file operations required
- Single entry point (index.php)

## High-Level Task Breakdown

### Phase 1: Foundation Infrastructure (Must Come First)
This phase creates the bare minimum infrastructure to support the application.

**What needs to be done:**
1. **Create directory structure** - Establish the folder hierarchy defined in SYSTEM_ARCHITECTURE.md
2. **Build configuration system** - Create config.php with application constants
3. **Implement basic utilities** - Build Validator and Logger classes for shared use
4. **Set up entry point** - Create index.php as the single entry point
5. **Configure environment security** - Create .htaccess for URL rewriting and access control

**Why this matters:**
- Sets the pattern for all future development
- Establishes security posture from day one
- Validates shared hosting compatibility early
- Creates reusable utilities for all subsequent stories

### Phase 2: URL Submission Interface (User-Facing)
This phase creates the minimal user interface for URL submission.

**What needs to be done:**
1. **Build submission form view** - Simple HTML form accepting URL input
2. **Create result/error display views** - Success and failure message templates
3. **Implement basic routing** - Simple Router class to handle GET/POST requests
4. **Handle form submission** - Process POST request, validate URL, provide feedback

**Why this matters:**
- Proves the user interaction flow
- Tests routing pattern that future features will use
- Validates form handling without framework
- Establishes view rendering approach

### Phase 3: Core Processing Pipeline (Backend)
This phase implements the minimal viable extraction pipeline.

**What needs to be done:**
1. **Build PageFetcher class** - HTTP client using cURL to fetch web pages
2. **Create basic RecipeExtractor orchestrator** - Coordinates extraction (initially just stub)
3. **Implement SchemaOrgExtractor** - Extract structured data (JSON-LD only for MVP)
4. **Build StorageManager** - Save recipe as JSON file with atomic writes
5. **Generate UUID utility** - Create unique recipe identifiers

**Why this matters:**
- Proves the extraction pipeline concept
- Validates that cURL works on shared hosting
- Tests file system write permissions
- Establishes extraction strategy pattern for future extractors

### Phase 4: Integration and Error Handling
This phase connects all components and ensures graceful failure.

**What needs to be done:**
1. **Wire components together** - Connect form submission → fetch → extract → save → display
2. **Implement comprehensive error handling** - Catch and log all failure modes
3. **Test on shared hosting** - Deploy to Hostinger, validate all constraints
4. **Handle edge cases** - Timeout, invalid URLs, malformed HTML, write failures

**Why this matters:**
- Proves end-to-end flow works in production
- Validates hosting constraint assumptions
- Establishes error handling patterns
- Builds confidence in the approach

## Components to Create

### Core Application Files
1. **/index.php** - Single entry point, request routing, error handling
2. **/config.php** - Application constants, paths, timeouts, autoloader
3. **/.htaccess** - URL rewriting, security headers, file access control

### Utility Classes (Foundation)
4. **/src/Utils/Validator.php** - URL validation using filter_var
5. **/src/Utils/Logger.php** - File-based error logging with context
6. **/src/Utils/UUID.php** - UUID v4 generation for recipe IDs

### Core Processing Classes
7. **/src/Core/Router.php** - Simple routing for GET/POST requests
8. **/src/Core/PageFetcher.php** - cURL wrapper with timeout, retries, error handling
9. **/src/Core/RecipeExtractor.php** - Orchestrator for extraction strategies
10. **/src/Core/StorageManager.php** - Atomic file writes, JSON persistence, locking

### Extraction Strategy (Minimal Viable)
11. **/src/Extractors/SchemaOrgExtractor.php** - JSON-LD extraction only (defer microdata)

### View Templates
12. **/src/Views/form.php** - URL submission form
13. **/src/Views/result.php** - Success message with extracted data preview
14. **/src/Views/error.php** - Error message display

### Data Storage Structure
15. **/recipes/data/.gitkeep** - Placeholder for recipe JSON files
16. **/recipes/index.json** - Recipe index (initially empty array)
17. **/logs/.gitkeep** - Placeholder for log files
18. **/config/.gitkeep** - Placeholder for configuration files (defer actual configs)

## Key Architectural Decisions Specific to FR-1

### Decision 1: Start with JSON-LD Only
**What:** Only implement Schema.org JSON-LD extraction in FR-1
**Why:**
- JSON-LD is the most common and reliable structured data format
- Simplifies initial implementation (no DOM traversal needed)
- Validates the extraction strategy pattern works
- Sets success baseline (60-70% of modern recipe sites use JSON-LD)
**Defer:** hRecipe and heuristic extractors to Sprint 4

### Decision 2: Minimal Router (No Framework)
**What:** Build a simple Router class with just GET/POST route registration and dispatch
**Why:**
- Validates ADR-002 decision (vanilla PHP is sufficient)
- Establishes routing pattern for future features (tagging, scaling)
- Avoids framework lock-in
- Proves simplicity is adequate
**Future:** Can migrate to Slim if complexity grows

### Decision 3: Stub Index Management
**What:** Create index.json but don't implement complex index queries yet
**Why:**
- Focus on core extraction flow
- Index optimization can be deferred until recipe count grows
- Proves file structure works
- Allows manual inspection during development
**Future:** Implement efficient index queries in Sprint 2-3

### Decision 4: Simple Error Display (No Partial Saves)
**What:** On failure, show error message but don't save partial data
**Why:**
- Simplifies initial implementation
- Reduces complexity around data validation
- Establishes "clean or nothing" principle
- Partial saves can be added in FR-10 (error handling story)
**Future:** Add partial save with warning flags in Sprint 3

### Decision 5: Deploy and Test Early
**What:** Deploy to Hostinger after Phase 2 completion (before full extraction)
**Why:**
- Validates hosting constraints aren't theoretical
- Discovers permission issues early
- Tests cURL availability and behavior
- Proves FTP deployment works
- Reduces risk before heavy investment in extraction logic

## Testing Strategy

### What to Test (Not How)

**1. URL Validation Testing**
- Valid HTTP/HTTPS URLs are accepted
- Invalid URL formats are rejected with clear error messages
- Edge cases: URLs with special characters, very long URLs, localhost URLs
- Security: Validate no code injection through URL parameter

**2. Page Fetching Testing**
- Successful fetch from live recipe sites
- Timeout handling (set to 15 seconds)
- Redirect following (up to 3 hops)
- SSL certificate validation
- HTTP error handling (404, 500, 503)
- Network failure handling (DNS resolution, connection refused)
- Fallback to file_get_contents if cURL unavailable

**3. Extraction Testing**
- Successful extraction from Schema.org JSON-LD sites
- Graceful handling when no JSON-LD present
- Malformed JSON handling
- Missing required fields handling
- Confidence level calculation accuracy

**4. Storage Testing**
- Recipe JSON file created with correct UUID filename
- Atomic write behavior (no corruption on interruption)
- File locking works (simulate concurrent writes)
- Directory permissions sufficient (writable by web server)
- Index.json updated correctly
- Data integrity (JSON is valid and parseable)

**5. Integration Testing**
- End-to-end flow: submit URL → fetch → extract → save → display
- Error flow: invalid URL → error message displayed
- Error flow: fetch failure → error logged and message displayed
- Error flow: extraction failure → error logged and message displayed
- Error flow: storage failure → error logged and message displayed

**6. Hosting Compatibility Testing**
- Deploy to actual Hostinger subdomain
- Verify PHP version is 7.4+
- Verify cURL extension available
- Verify DOMDocument class available
- Verify file write permissions work
- Verify execution completes within 30 seconds
- Verify memory usage stays under 128MB
- Verify .htaccess rules work correctly

**7. Security Testing**
- URL parameter sanitization prevents injection
- No directory traversal possible through file operations
- Error messages don't leak system information
- .htaccess blocks access to logs and config files
- File permissions prevent unauthorized access

## Documentation Needs

### Must Create
1. **README.md for /src/** - Explain folder structure and class organization
2. **DEPLOYMENT.md** - Step-by-step guide for FTP deployment to Hostinger
3. **TESTING_CHECKLIST.md** - Hosting compatibility validation checklist
4. **Code comments** - PHPDoc blocks for all classes and public methods

### Must Update
1. **CLAUDE.md** - Update with "project initialized" status and development conventions
2. **SYSTEM_ARCHITECTURE.md** - Mark Phase 1 components as "implemented"

### Defer to Later Stories
1. API documentation (no API yet)
2. User guide (minimal UI in FR-1)
3. Troubleshooting guide (accumulate issues first)

## PR Strategy: Single PR

**Recommendation: Single PR**

**Rationale:**
- FR-1 is inherently atomic - all components depend on each other
- Breaking into multiple PRs creates non-functional intermediate states
- This is the foundation - needs to be reviewed as a cohesive whole
- Small team (solo developer) makes large PR review manageable
- Testing requires all components working together

**PR Structure:**
- Title: "FR-1: Implement URL submission and extraction pipeline"
- Description: Link to PRD FR-1, list all components created
- Checklist: All acceptance criteria from PRD FR-1
- Testing notes: Include Hostinger deployment test results

## Implementation Sequence (Detailed)

### Step 1: Foundation Setup
**Objective:** Create skeleton that everything else builds on

1. Create directory structure (src, recipes, logs, config)
2. Create .gitkeep files to preserve empty directories in git
3. Build config.php with constants and autoloader
4. Build Validator.php (URL validation only)
5. Build Logger.php (error logging only)
6. Build UUID.php (simple v4 implementation)
7. Create .htaccess with security rules
8. Test: Verify autoloader loads classes correctly

### Step 2: View Layer
**Objective:** Prove basic HTTP request/response works

1. Build Router.php (simple GET/POST dispatch)
2. Create form.php view (HTML form with URL input)
3. Create result.php view (success message template)
4. Create error.php view (error message template)
5. Build index.php to serve form view
6. Test: Access form in browser, verify rendering

### Step 3: Form Handling
**Objective:** Prove form submission and validation works

1. Add POST route in index.php
2. Implement form data capture (\$_POST)
3. Call Validator::isValidUrl()
4. Return error view on invalid URL
5. Return success view on valid URL (stub response)
6. Test: Submit valid/invalid URLs, verify feedback

### Step 4: HTTP Fetching
**Objective:** Prove cURL works on hosting environment

1. Build PageFetcher.php (cURL implementation only)
2. Implement timeout, redirects, User-Agent
3. Implement retry logic for transient failures
4. Implement error handling and logging
5. Integrate into form POST handler
6. Test: Fetch real recipe URLs, verify HTML returned

### Step 5: Extraction Logic
**Objective:** Prove structured data extraction works

1. Build RecipeExtractor.php (orchestrator stub)
2. Build SchemaOrgExtractor.php (JSON-LD parsing)
3. Implement JSON-LD extraction from <script> tags
4. Parse recipe fields (title, ingredients, steps)
5. Calculate confidence level (basic: found/not found)
6. Integrate into form POST handler
7. Test: Extract from known JSON-LD recipe sites

### Step 6: Data Persistence
**Objective:** Prove file storage works with atomic writes

1. Build StorageManager.php
2. Implement atomic write pattern (temp file + rename)
3. Implement file locking (LOCK_EX)
4. Implement index.json update
5. Create initial index.json (empty recipes array)
6. Integrate into form POST handler
7. Test: Save recipe, verify JSON file created

### Step 7: Integration and Polish
**Objective:** Connect all pieces and handle edge cases

1. Wire full flow: fetch → extract → save → display
2. Implement comprehensive error handling (try/catch all steps)
3. Log all errors with context
4. Test timeout scenarios
5. Test invalid HTML scenarios
6. Test storage failure scenarios
7. Update result.php to show extracted recipe preview

### Step 8: Hosting Validation
**Objective:** Prove it works in production environment

1. Deploy entire codebase to Hostinger via FTP
2. Set directory permissions (755 for recipes/logs)
3. Verify .htaccess loads (test URL rewriting)
4. Test with real recipe URLs
5. Monitor error.log for issues
6. Verify execution time < 30 seconds
7. Verify memory usage < 128MB
8. Document any hosting-specific issues

## Potential Challenges and Mitigations

### Challenge 1: cURL Not Available on Hosting
**Likelihood:** Low (most shared hosting has cURL)
**Impact:** High (blocks fetching)
**Mitigation:** Implement file_get_contents fallback with stream context

### Challenge 2: File Write Permissions Denied
**Likelihood:** Medium (common shared hosting issue)
**Impact:** High (blocks storage)
**Mitigation:**
- Document permission requirements clearly
- Provide diagnostic script to test permissions
- Fallback to alternative directory if needed

### Challenge 3: Execution Timeout (<30 seconds)
**Likelihood:** Medium (depends on site speed)
**Impact:** Medium (affects user experience)
**Mitigation:**
- Set aggressive cURL timeout (15 seconds)
- Optimize JSON parsing (use built-in json_decode)
- Test with slow recipe sites early

### Challenge 4: JSON-LD Extraction Rate Lower Than Expected
**Likelihood:** Medium (varies by site popularity)
**Impact:** Low (expected, deferred extractors address this)
**Mitigation:**
- Set expectations in result message
- Show clear "extraction failed" message
- Encourage testing with popular recipe sites first

### Challenge 5: Autoloader Doesn't Work on Hostinger
**Likelihood:** Low (standard PHP feature)
**Impact:** Medium (requires manual require statements)
**Mitigation:**
- Test autoloader early in deployment
- Fall back to explicit require_once if needed
- Document any hosting quirks

## Dependencies Between Components

**Critical Path (Must Be Built in Order):**
1. config.php → (autoloader enables all other classes)
2. Validator.php, Logger.php, UUID.php → (utilities used by core classes)
3. Router.php → (routing enables views)
4. Views → (needed to display results)
5. PageFetcher.php → (must fetch before extracting)
6. RecipeExtractor.php → SchemaOrgExtractor.php → (orchestrator needs strategy)
7. StorageManager.php → (must save extracted data)
8. index.php integration → (wires everything together)

**Parallel Work Opportunities:**
- Validator, Logger, UUID can be built simultaneously
- Views can be built while core classes are being built
- PageFetcher and SchemaOrgExtractor can be built in parallel (use mock data)

## Success Criteria for FR-1 Completion

### Acceptance Criteria (From PRD)
- System accepts valid HTTP/HTTPS URLs ✓
- System validates URL format before processing ✓
- System provides feedback on submission status (success/failure) ✓

### Additional Success Criteria
- End-to-end flow works: URL → fetch → extract → save → display
- Recipe JSON file created in /recipes/data/
- Index.json updated with recipe metadata
- Errors logged to /logs/error.log with context
- Works on Hostinger shared hosting
- Extraction succeeds for 60%+ of modern recipe sites (JSON-LD only)
- No raw PHP errors displayed to users
- Execution completes within 30 seconds
- Code follows architecture patterns from SYSTEM_ARCHITECTURE.md

### Definition of Done
- All components created and integrated
- Deployed to Hostinger and tested
- All edge cases handled gracefully
- Error messages are user-friendly
- Code documented with PHPDoc blocks
- DEPLOYMENT.md created with hosting steps
- TESTING_CHECKLIST.md created
- PR reviewed and merged

## Summary: What Makes FR-1 Strategic

FR-1 is not just about URL submission - it's about:
1. **Proving the architecture** - Validates that vanilla PHP + flat files works
2. **Establishing patterns** - Sets conventions for routing, error handling, storage
3. **Validating constraints** - Tests shared hosting compatibility early
4. **Building confidence** - Demonstrates end-to-end flow before heavy investment
5. **Creating foundation** - Every future story builds on this infrastructure

The success or failure of FR-1 determines whether the entire architecture is viable. That's what makes this a strategic story, not just a tactical task.
