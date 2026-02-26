import { describe, it, expect, vi, afterEach } from 'vitest';
import { addCommand } from './add.js';
import * as urlLib from '../lib/url.js';
import { UserError } from '../lib/errors.js';

vi.mock('../lib/url.js');

describe('addCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints a confirmation to stdout on success', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', { ftp: true });

    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/')
    );
  });

  it('throws UserError when URL format is invalid', async () => {
    vi.mocked(urlLib.parseUrl).mockImplementation(() => {
      throw new UserError('Invalid URL: "not-a-url"');
    });

    await expect(addCommand('not-a-url', { ftp: true })).rejects.toThrow(UserError);
    await expect(addCommand('not-a-url', { ftp: true })).rejects.toThrow('Invalid URL');
  });

  it('throws UserError when URL is unreachable', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockRejectedValue(
      new UserError('URL is unreachable: ECONNREFUSED')
    );

    await expect(addCommand('https://example.com/', { ftp: true })).rejects.toThrow(UserError);
    await expect(addCommand('https://example.com/', { ftp: true })).rejects.toThrow('unreachable');
  });

  it('does not throw when --no-ftp is passed (ftp: false)', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(addCommand('https://example.com/', { ftp: false })).resolves.toBeUndefined();
  });
});
