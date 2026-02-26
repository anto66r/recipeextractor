import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseUrl, checkReachable } from './url.js';
import { UserError } from './errors.js';

describe('parseUrl', () => {
  it('returns a URL object for a valid https URL', () => {
    const result = parseUrl('https://example.com/recipe');
    expect(result.href).toBe('https://example.com/recipe');
  });

  it('returns a URL object for a valid http URL', () => {
    const result = parseUrl('http://example.com/recipe');
    expect(result.href).toBe('http://example.com/recipe');
  });

  it('throws UserError for a completely invalid URL string', () => {
    expect(() => parseUrl('not-a-url')).toThrow(UserError);
    expect(() => parseUrl('not-a-url')).toThrow('Invalid URL');
  });

  it('throws UserError for an empty string', () => {
    expect(() => parseUrl('')).toThrow(UserError);
    expect(() => parseUrl('')).toThrow('Invalid URL');
  });

  it('throws UserError for a non-http/https protocol', () => {
    expect(() => parseUrl('ftp://example.com')).toThrow(UserError);
    expect(() => parseUrl('ftp://example.com')).toThrow('http or https');
  });

  it('throws UserError for a mailto URL', () => {
    expect(() => parseUrl('mailto:user@example.com')).toThrow(UserError);
    expect(() => parseUrl('mailto:user@example.com')).toThrow('http or https');
  });

  it('preserves query strings and paths', () => {
    const result = parseUrl('https://example.com/recipes?id=123&sort=asc');
    expect(result.pathname).toBe('/recipes');
    expect(result.search).toBe('?id=123&sort=asc');
  });
});

describe('checkReachable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves when the URL returns a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, body: null })
    );
    await expect(checkReachable('https://example.com')).resolves.toBeUndefined();
  });

  it('throws UserError when server returns 301 (fetch does not follow redirect in stub)', async () => {
    // In this stub, fetch returns 301 directly (no redirect following).
    // Real fetch follows redirects automatically, so 301 is rarely seen by callers.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 301, body: null })
    );
    await expect(checkReachable('https://example.com')).rejects.toThrow(UserError);
    await expect(checkReachable('https://example.com')).rejects.toThrow('HTTP 301');
  });

  it('throws UserError for a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, body: null })
    );
    await expect(checkReachable('https://example.com')).rejects.toThrow(UserError);
    await expect(checkReachable('https://example.com')).rejects.toThrow('HTTP 404');
  });

  it('throws UserError for a 500 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, body: null })
    );
    await expect(checkReachable('https://example.com')).rejects.toThrow(UserError);
    await expect(checkReachable('https://example.com')).rejects.toThrow('HTTP 500');
  });

  it('throws UserError when fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(checkReachable('https://example.com')).rejects.toThrow(UserError);
    await expect(checkReachable('https://example.com')).rejects.toThrow('unreachable');
  });

  it('throws UserError when fetch times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))
    );
    await expect(checkReachable('https://example.com')).rejects.toThrow(UserError);
    await expect(checkReachable('https://example.com')).rejects.toThrow('unreachable');
  });
});
