# ADR-005: Atomic File Writes with Rename Pattern

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** System Architect
**Context:** Recipe Extractor file storage safety

---

## Context and Problem Statement

Recipe Extractor stores recipes as JSON files on disk. File write operations can be interrupted (power loss, timeout, disk full), potentially causing:

1. **Corrupted JSON files** - Partial write leaves invalid JSON
2. **Data loss** - Recipe partially written, unrecoverable
3. **Inconsistent state** - Recipe file and index.json out of sync

We must choose a file write strategy that prevents corruption and ensures data integrity.

---

## Decision Drivers

1. **Data integrity** - Never leave corrupted JSON files
2. **Atomicity** - Write succeeds completely or not at all
3. **Concurrent safety** - Handle multiple writes (even if rare)
4. **Shared hosting compatible** - Use standard PHP functions only
5. **Simplicity** - Avoid complex locking mechanisms
6. **Performance** - Minimal overhead for write operations
7. **Reliability** - Proven pattern on Unix/Linux systems

---

## Considered Options

### Option 1: Direct File Write

**Strategy:** Write directly to target file with `file_put_contents()`.

```php
file_put_contents($targetPath, $json);
```

**Pros:**
- Simple, one-line implementation
- Fast (no extra operations)
- Works everywhere

**Cons:**
- **Not atomic** - Write can be interrupted mid-operation
- **Corruption risk** - Partial write leaves invalid JSON
- **No recovery** - Corrupted file is lost
- **No concurrent safety** - Two writes can interleave

**Decision:** **REJECTED** - High risk of data corruption.

---

### Option 2: Direct Write with File Locking

**Strategy:** Lock file during write, preventing concurrent access.

```php
$handle = fopen($targetPath, 'c');
if (flock($handle, LOCK_EX)) {
    fwrite($handle, $json);
    fflush($handle);
    flock($handle, LOCK_UN);
}
fclose($handle);
```

**Pros:**
- Prevents concurrent writes (serialize access)
- Standard PHP functionality
- Works on shared hosting

**Cons:**
- **Still not atomic** - Write can still be interrupted
- **Corruption risk remains** - Partial write if interrupted
- **Blocking** - Other processes wait for lock
- File locking may not work on some network file systems

**Decision:** **REJECTED** - Doesn't solve atomicity problem.

---

### Option 3: Temp File + Rename (Atomic Write) - Selected

**Strategy:** Write to temporary file, then rename to target (atomic operation).

```php
$tempFile = $targetPath . '.tmp.' . uniqid();
file_put_contents($tempFile, $json, LOCK_EX);
rename($tempFile, $targetPath);  // Atomic on POSIX systems
```

**Pros:**
- **Atomic operation** - Rename is atomic on Unix/Linux
- **No corruption** - Either old file exists or new file exists
- **Safe interruption** - Interrupted write leaves temp file (cleaned up later)
- **Concurrent safe** - Multiple writes don't corrupt (last write wins)
- **Simple implementation** - Standard PHP functions
- **Proven pattern** - Used by databases, config systems

**Cons:**
- Slightly slower (two operations: write + rename)
- Temp files may accumulate if cleanup fails (mitigated with cleanup routine)
- Rename atomicity depends on file system (POSIX-compliant systems only)

**Decision:** **ACCEPTED** - Best balance of safety and simplicity.

---

### Option 4: Write-Ahead Log (WAL)

**Strategy:** Write to append-only log, periodically compact to main file.

**Pros:**
- High durability (all writes logged)
- Can recover from any failure

**Cons:**
- **Massive overkill** for single-user tool
- Complex implementation (log compaction, recovery)
- Performance overhead (double writes)
- Hard to debug and maintain

**Decision:** **REJECTED** - Too complex for use case.

---

### Option 5: Database Transactions

**Strategy:** Use SQLite with ACID transactions.

**Pros:**
- ACID guarantees
- Built-in atomicity

**Cons:**
- **Contradicts ADR-001** (flat-file storage decision)
- Adds database dependency
- More complex

**Decision:** **REJECTED** - Conflicts with flat-file storage decision.

---

## Decision Outcome

**Chosen Option:** **Temp File + Rename (Atomic Write Pattern)**

**Rationale:**
- **Atomic on POSIX systems** (Unix/Linux, including shared hosting)
- **Prevents corruption** - Either old or new file exists, never partial
- **Simple implementation** - Standard PHP functions
- **Concurrent safe** - Multiple writes don't corrupt
- **Proven pattern** - Used by many systems (database commit logs, config files)

---

## Implementation Details

### Atomic Write Function

**StorageManager.php:**

```php
class StorageManager {
    /**
     * Save recipe to file atomically.
     *
     * @param string $id Recipe UUID
     * @param array $recipeData Recipe data array
     * @return bool Success status
     */
    public function save(string $id, array $recipeData): bool {
        $targetPath = STORAGE_PATH . '/' . $id . '.json';
        $json = json_encode($recipeData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            Logger::error('JSON encoding failed', ['id' => $id, 'error' => json_last_error_msg()]);
            return false;
        }

        return $this->atomicWrite($targetPath, $json);
    }

    /**
     * Write file atomically using temp file + rename.
     *
     * @param string $targetPath Final file path
     * @param string $content File content
     * @return bool Success status
     */
    private function atomicWrite(string $targetPath, string $content): bool {
        // Generate unique temp filename
        $tempFile = $targetPath . '.tmp.' . uniqid(mt_rand(), true);

        try {
            // Write to temp file with exclusive lock
            $result = file_put_contents($tempFile, $content, LOCK_EX);

            if ($result === false) {
                Logger::error('Failed to write temp file', ['path' => $tempFile]);
                return false;
            }

            // Atomically rename temp file to target
            // This is atomic on POSIX-compliant systems
            if (!rename($tempFile, $targetPath)) {
                Logger::error('Failed to rename temp file', [
                    'temp' => $tempFile,
                    'target' => $targetPath
                ]);
                // Cleanup temp file
                @unlink($tempFile);
                return false;
            }

            return true;

        } catch (Exception $e) {
            Logger::error('Atomic write exception', [
                'path' => $targetPath,
                'error' => $e->getMessage()
            ]);

            // Cleanup temp file
            @unlink($tempFile);
            return false;
        }
    }
}
```

### How Atomicity Works

**POSIX Rename Semantics:**

On Unix/Linux systems (including shared hosting), `rename()` is atomic:
- If target file exists, it is **replaced atomically**
- If rename fails, target file is **unchanged**
- No intermediate state where target is partially written

**Flow:**

```
1. Write to temp file: /recipes/data/550e8400.json.tmp.abc123
   - If this fails, target file is untouched
   - If interrupted, temp file is incomplete (but target is safe)

2. Rename temp to target: /recipes/data/550e8400.json
   - Atomic operation (either succeeds completely or fails)
   - If succeeds: target file has new content
   - If fails: target file has old content (unchanged)

3. Result: Target file is NEVER corrupted
   - Either old version or new version exists
   - No partial/invalid JSON
```

### Handling Concurrent Writes

**Scenario:** Two processes try to write same recipe simultaneously.

**Without Atomic Writes:**
```
Process A: Write first half of JSON
Process B: Write first half of JSON  ← Interleaved!
Process A: Write second half of JSON
Process B: Write second half of JSON
Result: Corrupted file (mixture of both writes)
```

**With Atomic Writes:**
```
Process A: Write to temp1.json.tmp, rename to recipe.json
Process B: Write to temp2.json.tmp, rename to recipe.json
Result: Last rename wins (recipe.json has Process B's data)
       Process A's data is lost, but no corruption
```

**Note:** Concurrent writes are rare (single-user tool), but this pattern handles them safely.

---

## Consequences

### Positive Consequences

- **No corruption** - JSON files never left in invalid state
- **Atomic guarantee** - Either old or new file exists
- **Safe interruption** - Power loss, timeout won't corrupt target
- **Concurrent safe** - Multiple writes don't corrupt (last write wins)
- **Simple implementation** - Standard PHP functions
- **Proven pattern** - Used by databases, config systems
- **POSIX compatible** - Works on Unix/Linux shared hosting

### Negative Consequences

- **Temp file accumulation** - Failed writes leave temp files (mitigated with cleanup)
- **Slightly slower** - Two operations instead of one (negligible: <1ms)
- **Last write wins** - Concurrent writes result in data loss (acceptable: single user)
- **Not atomic on non-POSIX** - Windows may have issues (not a concern for Hostinger)

### Mitigation Strategies

1. **Temp File Cleanup:**
   - Implement periodic cleanup of old temp files
   - Clean temp files older than 1 hour
   - Run on each save operation (lightweight check)

```php
private function cleanupOldTempFiles(): void {
    $pattern = STORAGE_PATH . '/*.tmp.*';
    $tempFiles = glob($pattern);
    $now = time();

    foreach ($tempFiles as $file) {
        if ($now - filemtime($file) > 3600) {  // 1 hour
            @unlink($file);
        }
    }
}
```

2. **Concurrent Write Loss:**
   - Acceptable for single-user tool (rare scenario)
   - If multi-user support added, implement proper locking with version checks
   - Log concurrent writes for monitoring

3. **Disk Full:**
   - `file_put_contents()` will fail (returns false)
   - Error logged, user notified
   - Target file unchanged (safe)

---

## Edge Cases

### 1. Disk Full During Write

**Scenario:** Disk full while writing temp file.

**Behavior:**
```php
$result = file_put_contents($tempFile, $content, LOCK_EX);
// $result === false
```

**Outcome:**
- Temp file write fails (returns false)
- Error logged
- Target file unchanged (safe)
- User notified of failure

---

### 2. Disk Full During Rename

**Scenario:** Disk full during rename operation (very rare).

**Behavior:**
```php
rename($tempFile, $targetPath);  // May fail
```

**Outcome:**
- Rename fails (returns false)
- Error logged
- Temp file remains (cleaned up later)
- Target file unchanged (safe)

---

### 3. Permission Denied

**Scenario:** No write permission on target directory.

**Behavior:**
- Temp file write fails
- Or rename fails

**Outcome:**
- Error logged
- User notified
- No corruption

---

### 4. Power Loss During Write

**Scenario:** Power loss while writing temp file.

**Outcome:**
- Temp file partially written (incomplete)
- Target file unchanged (safe)
- Temp file cleaned up on next run
- No corruption

---

### 5. Power Loss During Rename

**Scenario:** Power loss during rename operation (extremely rare).

**Outcome:**
- Rename is atomic (either completes or doesn't)
- Target file has old or new content (never partial)
- Temp file may remain (cleaned up later)
- No corruption

---

## Testing Strategy

### Unit Tests

```php
class AtomicWriteTest {
    public function testSuccessfulWrite() {
        $storage = new StorageManager();
        $result = $storage->save('test-uuid', ['title' => 'Test Recipe']);

        $this->assertTrue($result);
        $this->assertFileExists(STORAGE_PATH . '/test-uuid.json');

        $json = file_get_contents(STORAGE_PATH . '/test-uuid.json');
        $data = json_decode($json, true);
        $this->assertEquals('Test Recipe', $data['title']);
    }

    public function testOverwriteExisting() {
        $storage = new StorageManager();

        // Write v1
        $storage->save('test-uuid', ['title' => 'Version 1']);

        // Write v2 (overwrite)
        $storage->save('test-uuid', ['title' => 'Version 2']);

        $json = file_get_contents(STORAGE_PATH . '/test-uuid.json');
        $data = json_decode($json, true);
        $this->assertEquals('Version 2', $data['title']);
    }

    public function testTempFilesCleanedUp() {
        // Create old temp file
        $tempFile = STORAGE_PATH . '/test.json.tmp.old';
        touch($tempFile, time() - 7200);  // 2 hours old

        $storage = new StorageManager();
        $storage->save('test-uuid', ['title' => 'Test']);

        // Old temp file should be cleaned up
        $this->assertFileNotExists($tempFile);
    }
}
```

---

## Related Decisions

- ADR-001: Flat-File JSON Storage (requires safe file writes)
- ADR-002: Vanilla PHP (use standard PHP file functions)

---

## References

- POSIX Rename Atomicity: https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html
- Atomic File Operations: https://lwn.net/Articles/457667/
- PHP rename() function: https://www.php.net/manual/en/function.rename.php
- PHP file_put_contents(): https://www.php.net/manual/en/function.file-put-contents.php

---

**Status:** Accepted
**Last Reviewed:** 2026-02-26
**Next Review:** After Sprint 1 completion (validate on Hostinger)
