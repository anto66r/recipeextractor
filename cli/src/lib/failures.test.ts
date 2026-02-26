import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logFailure } from './failures.js';

vi.mock('node:fs/promises', () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import * as fs from 'node:fs/promises';

describe('logFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appends a tab-separated line to failures.log', async () => {
    await logFailure('https://example.com/', 'Connection refused');

    expect(fs.appendFile).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(fs.appendFile).mock.calls[0] as [string, string, string];
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T/); // starts with ISO timestamp
    expect(content).toContain('https://example.com/');
    expect(content).toContain('Connection refused');
    expect(content.endsWith('\n')).toBe(true);
  });

  it('creates the logs directory before appending', async () => {
    await logFailure('https://example.com/', 'some error');

    expect(fs.mkdir).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(fs.mkdir).mock.calls[0] as [string, { recursive: boolean }];
    expect(opts).toEqual({ recursive: true });
    // mkdir must have been called (which happens before appendFile in the implementation)
    expect(fs.appendFile).toHaveBeenCalledOnce();
  });

  it('writes three tab-separated fields per line', async () => {
    await logFailure('https://example.com/', 'reason text');

    const [, content] = vi.mocked(fs.appendFile).mock.calls[0] as [string, string, string];
    const parts = content.trimEnd().split('\t');
    expect(parts).toHaveLength(3);
    expect(parts[1]).toBe('https://example.com/');
    expect(parts[2]).toBe('reason text');
  });
});
