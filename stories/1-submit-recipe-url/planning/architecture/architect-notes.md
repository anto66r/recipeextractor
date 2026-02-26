# Architecture Review for FR-1

## Review Status
Architecture review was completed for the entire project prior to story implementation. This story (FR-1) follows the established architecture.

## Architecture Documents
All architectural decisions are documented in the project root:

### Primary Architecture Document
- **Location:** `/SYSTEM_ARCHITECTURE.md`
- **Contents:** Overall architecture, folder structure, component design, data model, implementation order
- **Created:** 2026-02-26 (prior to FR-1 planning)

### Architecture Decision Records (ADRs)
- **Location:** `/docs/adr/`
- **Created:** 2026-02-26 (prior to FR-1 planning)

#### ADR-001: Flat-File JSON Storage
- **Decision:** Use JSON files instead of database
- **Rationale:** Shared hosting constraint, simplicity, adequate for <10k recipes
- **Impact on FR-1:** StorageManager must implement atomic file writes

#### ADR-002: Vanilla PHP (No Framework)
- **Decision:** Use vanilla PHP without Laravel/Symfony
- **Rationale:** Simplicity, FTP deployment, minimal overhead
- **Impact on FR-1:** Must build Router, utilities from scratch

#### ADR-003: Multi-Strategy Extraction Pattern
- **Decision:** Try Schema.org → hRecipe → Heuristic in order
- **Rationale:** Maximize success rate, graceful degradation
- **Impact on FR-1:** Start with JSON-LD only, establish pattern for future extractors

#### ADR-004: Metric Storage Standard
- **Decision:** Store all measurements in metric, preserve originals
- **Rationale:** International standard, consistent calculations
- **Impact on FR-1:** Not directly impacted (defer to FR-7)

#### ADR-005: Atomic File Writes
- **Decision:** Use temp file + rename pattern
- **Rationale:** POSIX atomic operation, prevents corruption
- **Impact on FR-1:** Critical for StorageManager implementation

## FR-1 Specific Architectural Guidance

### Components to Follow Architecture
All FR-1 components must follow the layered architecture defined in SYSTEM_ARCHITECTURE.md:

```
Entry Point (index.php)
    ↓
Core Processing (Router, PageFetcher, RecipeExtractor, StorageManager)
    ↓
Extractors (SchemaOrgExtractor)
    ↓
Utilities (Validator, Logger, UUID)
```

### Folder Structure to Implement
```
/index.php                          - Entry point
/config.php                         - Configuration + autoloader
/.htaccess                          - Security + URL rewriting
/src/Core/                          - Core processing classes
/src/Extractors/                    - Extraction strategies
/src/Utils/                         - Utilities
/src/Views/                         - View templates
/recipes/data/                      - Recipe JSON files
/recipes/index.json                 - Recipe index
/logs/                              - Error logs
/config/                            - Config files
```

### Security Considerations
Per SYSTEM_ARCHITECTURE.md Section 7 (Security):
- Input validation: All URLs validated with `filter_var(FILTER_VALIDATE_URL)`
- Output encoding: HTML-escape all user-facing output
- File access: .htaccess blocks direct access to /logs/, /config/, /recipes/data/
- Error handling: No stack traces or system info in user-facing errors

### Performance Constraints
Per SYSTEM_ARCHITECTURE.md Section 6 (Hosting Compatibility):
- Execution time: Must complete within 30 seconds
- Memory usage: Keep under 128MB
- cURL timeout: 15 seconds max
- File operations: Use atomic writes (ADR-005)

## No New Architectural Decisions Required

FR-1 is straightforward and fully covered by existing architectural decisions. No new architectural concerns arose during planning.

## Architect Consultation Not Needed

Per the implementation workflow, architect consultation is only needed for:
- Data model changes ❌ (not applicable to FR-1)
- New dependencies ❌ (vanilla PHP, no deps)
- External API integrations ❌ (only fetching public web pages)
- Performance-critical features ❌ (standard shared hosting load)
- Security-sensitive data ❌ (no auth, payments, or PII)
- Caching or resiliency patterns ❌ (deferred to later stories)

FR-1 follows the established architecture exactly as designed.

## Next Story Requiring Architecture Review

Future stories that may require additional architectural input:
- **FR-5 (Tagging):** May need architect input on tag data model structure
- **FR-7 (Unit Conversion):** Confirm conversion factors storage approach
- **FR-8 (Recipe Scaling):** May need architect input on scaling algorithm approach

For FR-1, implementation can proceed directly using the established architecture.
