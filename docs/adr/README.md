# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Recipe Extractor project.

## What are ADRs?

ADRs document significant architectural decisions, including:
- Context and problem statement
- Considered options with pros/cons
- Final decision and rationale
- Consequences and tradeoffs

## Index of ADRs

### Active Decisions

| ADR | Title | Status | Date | Impact |
|-----|-------|--------|------|--------|
| [ADR-001](ADR-001-flat-file-json-storage.md) | Use Flat-File JSON Storage Instead of Database | Accepted | 2026-02-26 | High |
| [ADR-002](ADR-002-vanilla-php-no-framework.md) | Use Vanilla PHP Without Framework | Accepted | 2026-02-26 | High |
| [ADR-003](ADR-003-multi-strategy-extraction-pattern.md) | Multi-Strategy Extraction Pattern | Accepted | 2026-02-26 | High |
| [ADR-004](ADR-004-metric-storage-standard.md) | Store All Measurements in Metric Units | Accepted | 2026-02-26 | Medium |
| [ADR-005](ADR-005-atomic-file-writes.md) | Atomic File Writes with Rename Pattern | Accepted | 2026-02-26 | Medium |

---

## Decision Summary

### ADR-001: Flat-File JSON Storage

**Problem:** How to persist recipe data?

**Decision:** Use flat-file JSON storage (one file per recipe) instead of database.

**Rationale:**
- Works on shared hosting (no database required)
- Simple backup/restore (copy directory)
- Human-readable for debugging
- Adequate for expected scale (<10k recipes)

**Tradeoffs:**
- Limited search performance (must read multiple files)
- No ACID transactions
- Manual index maintenance

**Migration Path:** Move to SQLite if scale exceeds 10k recipes.

---

### ADR-002: Vanilla PHP Without Framework

**Problem:** Which PHP framework to use?

**Decision:** Use vanilla PHP (no framework).

**Rationale:**
- Simplicity matches use case (single-purpose tool)
- Simple deployment (FTP upload, no Composer)
- Minimal overhead (important for shared hosting)
- Full control over behavior

**Tradeoffs:**
- Must implement utilities manually (routing, validation)
- Less structure (requires discipline)

**Migration Path:** Consider Slim micro-framework if scope expands significantly.

---

### ADR-003: Multi-Strategy Extraction Pattern

**Problem:** How to extract recipes from diverse websites?

**Decision:** Try extraction strategies in priority order:
1. Schema.org (JSON-LD, microdata) - High confidence
2. hRecipe microformat - Medium confidence
3. Heuristic HTML parsing - Low confidence

**Rationale:**
- Maximizes success rate (covers widest range of sites)
- Prioritizes reliability (structured data first)
- Graceful degradation (always try to extract something)
- Transparent confidence levels

**Tradeoffs:**
- More complex (multiple extractor classes)
- Heuristic fallback may produce low-quality results

---

### ADR-004: Store All Measurements in Metric

**Problem:** Which unit system to use for storage?

**Decision:** Convert all measurements to metric on extraction. Preserve original values separately.

**Rationale:**
- Consistency (all recipes in same unit system)
- International standard (metric used globally)
- Simple scaling (multiply quantities without conversion)
- Precise calculations (decimal-based)

**Tradeoffs:**
- Conversion logic required
- Small rounding errors (within 2% tolerance)

---

### ADR-005: Atomic File Writes

**Problem:** How to prevent corrupted JSON files?

**Decision:** Use temp file + rename pattern for atomic writes.

**Rationale:**
- Atomic on POSIX systems (Unix/Linux)
- Prevents corruption (either old or new file exists)
- Safe interruption (target file never partial)
- Simple implementation (standard PHP functions)

**Tradeoffs:**
- Slightly slower (two operations)
- Temp files may accumulate (mitigated with cleanup)

---

## ADR Process

### When to Create an ADR

Create an ADR for decisions that:
- Affect system architecture or design
- Have long-term implications
- Involve significant tradeoffs
- May be questioned in the future

### ADR Template

Use this template for new ADRs:

```markdown
# ADR-XXX: [Title]

**Status:** [Proposed/Accepted/Deprecated/Superseded]
**Date:** YYYY-MM-DD
**Deciders:** [Names]
**Context:** [Brief description]

---

## Context and Problem Statement

[Describe the problem and context]

## Decision Drivers

[List factors influencing decision]

## Considered Options

### Option 1: [Name]

**Pros/Cons/Decision**

[Repeat for other options]

## Decision Outcome

**Chosen Option:** [Name]

**Rationale:** [Why chosen]

## Implementation Details

[How to implement]

## Consequences

**Positive/Negative/Mitigation**

## Related Decisions

[Links to related ADRs]

## References

[External links]
```

---

## Review Schedule

ADRs should be reviewed:
- **After Sprint 1:** Validate ADR-001, ADR-002, ADR-005 (test on Hostinger)
- **After Sprint 2:** Validate ADR-004 (conversion accuracy)
- **After Sprint 3:** Validate ADR-003 (extraction success rate)
- **At project completion:** Full ADR review, identify lessons learned

---

## Questions or Changes?

If you disagree with a decision or conditions have changed:

1. Review the ADR and understand the original rationale
2. Document why conditions have changed
3. Propose alternative with pros/cons
4. Discuss with team
5. If approved, create new ADR superseding old one

**Never modify historical ADRs.** Create new ADRs that supersede old ones.

---

**Last Updated:** 2026-02-26
