# FR-1 Planning Notes

## Story Context
- **ID:** FR-1
- **Title:** Submit a recipe URL for extraction
- **Type:** Full-Stack (frontend form + backend validation)
- **Complexity:** Simple
- **Estimated Effort:** 2-3 hours implementation, 1-2 hours testing

## Architecture Review
Architecture review was completed prior to planning this story. All architectural decisions are documented in:
- `/SYSTEM_ARCHITECTURE.md` — Overall architecture, folder structure, component design
- `/docs/adr/ADR-001` through `ADR-005` — Key architectural decisions

### Key Architectural Constraints Confirmed
- Vanilla PHP 7.4+ (no framework, no Composer)
- Flat-file JSON storage (no database)
- Hostinger shared hosting compatibility
- No CLI access, no cron jobs
- HTTP/HTTPS handled by hosting provider

## Story Dependencies
**Blocks:** FR-2, FR-3, FR-4 (entire pipeline depends on this foundation)
**Blocked by:** None (first story)

## User Context
- **Hosting:** Hostinger subdomain (shared hosting)
- **Tech Stack:** PHP (confirmed available)
- **No framework preference:** Vanilla PHP acceptable
- **Deployment:** Simple FTP upload

## Implementation Decisions Made During Planning

### 1. Start with JSON-LD Only
For FR-1, only implement Schema.org JSON-LD extraction. Defer hRecipe and heuristic extractors to later stories. This simplifies initial implementation while proving the architecture works.

**Rationale:**
- JSON-LD is most reliable (60-70% of modern recipe sites)
- No complex DOM traversal needed
- Validates extraction strategy pattern
- Reduces initial complexity

### 2. Single PR Strategy
All FR-1 components in one PR, as they're interdependent and form the foundation.

**Alternative considered:** Split into 2 PRs (foundation + pipeline), but rejected because intermediate state wouldn't be functional.

### 3. Deploy Early
Plan to deploy to Hostinger after Phase 2 (views layer) to validate hosting constraints before investing heavily in extraction logic.

### 4. Stub Index Management
Create `index.json` but don't implement complex queries yet. Defer optimization until recipe count grows.

### 5. No Partial Saves in FR-1
On extraction failure, show error but don't save partial data. Defer partial saves with warning flags to FR-10 (error handling story).

## Risks Identified
1. **cURL availability** — Likelihood: Low, Mitigation: file_get_contents fallback
2. **File permissions** — Likelihood: Medium, Mitigation: Clear docs, diagnostic script
3. **Execution timeout** — Likelihood: Medium, Mitigation: 15-second cURL timeout
4. **JSON-LD extraction rate** — Likelihood: Medium, Impact: Low (expected, acceptable for v1)

## Testing Strategy Highlights
- Unit tests for URL validation
- Integration test for full pipeline
- Hosting compatibility checklist for Hostinger deployment
- Security testing (no injection, no directory traversal)

## Documentation to Create
- README.md for /src/ (folder structure guide)
- DEPLOYMENT.md (FTP deployment steps for Hostinger)
- TESTING_CHECKLIST.md (hosting validation checklist)
- PHPDoc blocks for all classes

## Notes from User
- "App will be hosted on a subdomain of my Hostinger hosting, so we don't have to worry about http handling"
- Confirmed shared hosting constraints (no CLI, no cron)
- FTP deployment acceptable

## Planning Completed
- Date: 2026-02-26
- Plan saved to: `stories/1-submit-recipe-url/planning/plan.md`
- Status: Awaiting user approval
