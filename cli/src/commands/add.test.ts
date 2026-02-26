import { describe, it, expect, vi, afterEach } from 'vitest';
import { addCommand } from './add.js';
import * as urlLib from '../lib/url.js';
import * as browserService from '../services/browser.js';
import * as extractorService from '../services/extractor.js';
import * as storageService from '../services/storage.js';
import * as failures from '../lib/failures.js';
import * as ftpService from '../services/ftp.js';
import { UserError } from '../lib/errors.js';

vi.mock('../lib/url.js');
vi.mock('../services/browser.js');
vi.mock('../services/extractor.js');
vi.mock('../services/storage.js');
vi.mock('../lib/failures.js');
vi.mock('../services/ftp.js');

const defaultOptions = { ftp: true, images: true };

const mockExtracted = {
  title: 'Pasta Carbonara',
  description: 'A classic Roman pasta dish.',
  originalServings: 2,
  servings: 4 as const,
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  tags: ['Italian', 'dinner'] as Array<'Italian' | 'dinner'>,
  ingredients: [{ quantity: '400g', item: 'spaghetti' }],
  steps: ['Boil water.', 'Cook pasta.'],
};

const mockRecipe = {
  schemaVersion: 2 as const,
  id: 'test-uuid-1234',
  slug: 'pasta-carbonara',
  title: 'Pasta Carbonara',
  description: 'A classic Roman pasta dish.',
  sourceUrl: 'https://example.com/',
  originalServings: 2,
  servings: 4 as const,
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  tags: ['Italian', 'dinner'] as Array<'Italian' | 'dinner'>,
  images: [],
  ingredients: [{ quantity: '400g', item: 'spaghetti' }],
  steps: ['Boil water.', 'Cook pasta.'],
  createdAt: '2026-02-26T12:00:00.000Z',
};

describe('addCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints a confirmation to stdout on success', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', defaultOptions);

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('https://example.com/'));
  });

  it('prints extracted recipe title on success', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', defaultOptions);

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Pasta Carbonara'));
  });

  it('calls renderPage with the validated URL', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/recipe'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/recipe', defaultOptions);

    expect(browserService.renderPage).toHaveBeenCalledWith('https://example.com/recipe');
  });

  it('calls extract with the rendered html and URL', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html>rendered</html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', defaultOptions);

    expect(extractorService.extract).toHaveBeenCalledWith(
      '<html>rendered</html>',
      'https://example.com/'
    );
  });

  it('calls saveRecipe with extracted recipe and URL', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', defaultOptions);

    expect(storageService.saveRecipe).toHaveBeenCalledWith(mockExtracted, 'https://example.com/');
  });

  it('calls logFailure and rethrows when renderPage throws', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockRejectedValue(
      new UserError('Failed to load page: timeout')
    );
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    await expect(addCommand('https://example.com/', defaultOptions)).rejects.toThrow(UserError);
    expect(failures.logFailure).toHaveBeenCalledWith(
      'https://example.com/',
      expect.stringContaining('Failed to load page')
    );
  });

  it('calls logFailure and rethrows when extract throws', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockRejectedValue(
      new UserError('Failed to extract after 2 attempts')
    );
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    await expect(addCommand('https://example.com/', defaultOptions)).rejects.toThrow(UserError);
    expect(failures.logFailure).toHaveBeenCalledWith(
      'https://example.com/',
      expect.stringContaining('Failed to extract')
    );
  });

  it('throws UserError when URL format is invalid', async () => {
    vi.mocked(urlLib.parseUrl).mockImplementation(() => {
      throw new UserError('Invalid URL: "not-a-url"');
    });

    await expect(addCommand('not-a-url', defaultOptions)).rejects.toThrow(UserError);
    await expect(addCommand('not-a-url', defaultOptions)).rejects.toThrow('Invalid URL');
  });

  it('throws UserError when URL is unreachable', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockRejectedValue(
      new UserError('URL is unreachable: ECONNREFUSED')
    );
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    await expect(addCommand('https://example.com/', defaultOptions)).rejects.toThrow('unreachable');
  });

  it('calls logFailure when URL is unreachable (per spec)', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockRejectedValue(
      new UserError('URL is unreachable: ECONNREFUSED')
    );
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    await expect(addCommand('https://example.com/', defaultOptions)).rejects.toThrow(UserError);
    expect(failures.logFailure).toHaveBeenCalledWith(
      'https://example.com/',
      expect.stringContaining('unreachable')
    );
  });

  it('rethrows the original error even when logFailure itself throws', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    const originalError = new UserError('Failed to extract after 2 attempts');
    vi.mocked(extractorService.extract).mockRejectedValue(originalError);
    vi.mocked(failures.logFailure).mockRejectedValue(new Error('ENOSPC: no space left on device'));

    const thrown = await addCommand('https://example.com/', defaultOptions).catch((e) => e);
    expect(thrown).toBe(originalError);
  });

  it('does not call logFailure for URL validation errors (before extraction)', async () => {
    vi.mocked(urlLib.parseUrl).mockImplementation(() => {
      throw new UserError('Invalid URL');
    });
    vi.mocked(failures.logFailure).mockResolvedValue(undefined);

    await expect(addCommand('bad-url', defaultOptions)).rejects.toThrow(UserError);
    expect(failures.logFailure).not.toHaveBeenCalled();
  });

  it('does not throw when --no-ftp is passed (ftp: false)', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await expect(
      addCommand('https://example.com/', { ftp: false, images: true })
    ).resolves.toBeUndefined();
  });

  it('calls syncRecipe with the recipe id when ftp: true', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.mocked(ftpService.syncRecipe).mockResolvedValue(undefined);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', { ftp: true, images: true });

    expect(ftpService.syncRecipe).toHaveBeenCalledWith('test-uuid-1234');
  });

  it('does not call syncRecipe when --no-ftp (ftp: false)', async () => {
    vi.mocked(urlLib.parseUrl).mockReturnValue(new URL('https://example.com/'));
    vi.mocked(urlLib.checkReachable).mockResolvedValue(undefined);
    vi.mocked(browserService.renderPage).mockResolvedValue({
      html: '<html></html>',
      imageCandidates: [],
    });
    vi.mocked(extractorService.extract).mockResolvedValue(mockExtracted);
    vi.mocked(storageService.saveRecipe).mockResolvedValue(mockRecipe);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await addCommand('https://example.com/', { ftp: false, images: true });

    expect(ftpService.syncRecipe).not.toHaveBeenCalled();
  });
});
