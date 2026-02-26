# ADR-001: Use Flat-File JSON Storage Instead of Database

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** System Architect
**Context:** Recipe Extractor data persistence strategy

---

## Context and Problem Statement

Recipe Extractor needs to persist extracted recipe data reliably. We must choose between:

1. **Relational database** (MySQL, PostgreSQL)
2. **Embedded database** (SQLite)
3. **Flat-file storage** (JSON, XML)
4. **NoSQL database** (MongoDB, Redis)

The solution must work on **Hostinger shared hosting** with no guaranteed database access, support modest scale (<10k recipes), and be simple to maintain.

---

## Decision Drivers

1. **Hosting constraint** - Shared hosting with no guaranteed database access
2. **Simplicity** - Single-user personal tool, not enterprise app
3. **Deployment ease** - No database setup/migration required
4. **Backup/restore** - Simple file copy should work
5. **Debugging** - Human-readable format preferred
6. **Scale** - Expected <10k recipes (modest)
7. **Maintainability** - Minimal dependencies

---

## Considered Options

### Option 1: MySQL/PostgreSQL Database

**Pros:**
- ACID transactions
- Efficient querying and indexing
- Proven for high concurrency
- Rich query language (SQL)

**Cons:**
- **Not available on all shared hosting plans** (blocker)
- Requires database setup and credentials
- Migration scripts needed for schema changes
- Overkill for single-user, modest scale
- Additional maintenance burden

**Decision:** **REJECTED** - Hosting constraint is a blocker.

---

### Option 2: SQLite Embedded Database

**Pros:**
- No server required (file-based)
- ACID transactions
- SQL query capabilities
- Good performance for modest scale
- Widely available on shared hosting

**Cons:**
- Still a database (adds complexity vs flat files)
- Requires PHP PDO/SQLite extension (may not be enabled)
- Schema migrations needed
- Less human-readable than JSON
- Overkill for single-user use case

**Decision:** **CONSIDER FOR V2** - Good option if scale exceeds 10k recipes.

---

### Option 3: Flat-File JSON Storage (Selected)

**Pros:**
- **No database required** (works on any shared hosting)
- **Human-readable** (easy debugging, manual edits if needed)
- **Simple backup** (copy `/recipes/` directory)
- **No migrations** (schema changes handled in code)
- **Simple deployment** (upload files via FTP)
- **Adequate performance** for expected scale (<10k recipes)
- **Version control friendly** (can commit sample recipes to git)

**Cons:**
- **No efficient search/filter** (must read multiple files)
- **No ACID transactions** across recipes (risk of inconsistency)
- **Manual index maintenance** (must keep index.json in sync)
- **Concurrency challenges** (file locking required)
- **Not scalable** beyond ~10k recipes

**Decision:** **ACCEPTED** - Best fit for constraints and use case.

---

### Option 4: NoSQL Database (MongoDB, Redis)

**Pros:**
- JSON-like storage (natural fit)
- Scalable
- Flexible schema

**Cons:**
- **Not available on shared hosting** (blocker)
- Requires separate server/service
- Adds significant complexity
- Overkill for use case

**Decision:** **REJECTED** - Hosting constraint is a blocker.

---

## Decision Outcome

**Chosen Option:** **Flat-File JSON Storage**

**Rationale:**
- Satisfies critical hosting constraint (no database required)
- Simplicity aligns with single-user, personal tool use case
- Human-readable format aids debugging and manual inspection
- Adequate performance for expected scale (<10k recipes)
- Easy backup/restore (simple file copy)

---

## Implementation Details

### File Structure

```
/recipes/
  /data/
    550e8400-e29b-41d4-a716-446655440000.json
    662f9511-f30c-52e5-b827-557766551111.json
  index.json
```

### Recipe File Format

Each recipe stored as `{uuid}.json`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/recipe",
  "title": "Recipe Title",
  "extractedAt": "2026-02-26T10:30:00Z",
  "ingredients": [...],
  "steps": [...],
  "tags": {...},
  "metadata": {...}
}
```

### Index File Format

Lightweight index (`index.json`) for quick lookups:

```json
{
  "recipes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Recipe Title",
      "url": "https://example.com/recipe",
      "extractedAt": "2026-02-26T10:30:00Z",
      "tags": ["italian", "pasta"]
    }
  ],
  "lastUpdated": "2026-02-26T10:30:00Z",
  "totalRecipes": 1
}
```

### Concurrency Safety

Use file locking to prevent concurrent write conflicts:

```php
$handle = fopen($file, 'c+');
if (flock($handle, LOCK_EX)) {
    fwrite($handle, $json);
    fflush($handle);
    flock($handle, LOCK_UN);
}
fclose($handle);
```

### Atomic Writes

Use temp file + rename pattern to prevent corruption:

```php
$tempFile = $targetPath . '.tmp.' . uniqid();
file_put_contents($tempFile, $json, LOCK_EX);
rename($tempFile, $targetPath);  // Atomic on Unix
```

---

## Consequences

### Positive Consequences

- **Works on any shared hosting** (no database requirement)
- **Simple to deploy** (FTP upload, no database setup)
- **Easy to backup** (copy directory)
- **Human-readable** (can inspect/debug with text editor)
- **Version control friendly** (can commit samples to git)
- **No migration scripts** needed for schema changes

### Negative Consequences

- **Limited search performance** (must read multiple files)
- **No built-in transactions** (risk of inconsistent state)
- **Manual index maintenance** (must update index.json on writes)
- **Concurrency limitations** (file locking required)
- **Scale ceiling** (~10k recipes before performance degrades)

### Mitigation Strategies

1. **Search Performance:**
   - Implement lightweight index.json with metadata only
   - Use PHP opcache to reduce file read overhead
   - Consider moving to SQLite if queries become slow

2. **Concurrency:**
   - Use file locking (LOCK_EX) on all writes
   - Single-user assumption reduces contention
   - Atomic writes prevent corruption

3. **Scale:**
   - Monitor recipe count and file system performance
   - Plan migration to SQLite if scale exceeds 10k recipes
   - Archive old recipes to separate directory if needed

4. **Index Consistency:**
   - Always update index.json atomically with recipe file
   - Add validation to detect index/data mismatches
   - Provide "rebuild index" utility function

---

## Migration Path (If Needed)

If scale exceeds 10k recipes or query performance degrades:

1. **Migrate to SQLite:**
   - Create SQLite database schema matching JSON structure
   - Write migration script to import all JSON files
   - Update StorageManager to use PDO instead of file operations
   - Keep JSON export capability for backup

2. **Cost:** ~2-3 days development + testing

3. **Trigger:** Recipe count > 10k OR average query time > 2 seconds

---

## Related Decisions

- ADR-005: Atomic File Writes with Rename Pattern
- ADR-002: Use Vanilla PHP Without Framework (no ORM needed)

---

## References

- PHP file locking: https://www.php.net/manual/en/function.flock.php
- Atomic file operations: https://stackoverflow.com/questions/28162639/atomic-file-write-operations
- JSON storage patterns: https://jsonlines.org/

---

**Status:** Accepted
**Last Reviewed:** 2026-02-26
**Next Review:** After Sprint 2 completion (reassess performance)
