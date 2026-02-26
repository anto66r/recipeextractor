import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserError } from '../lib/errors.js';

// vi.hoisted() runs before vi.mock hoisting, making these available in the factory
const {
  mockClose,
  mockContent,
  mockSetUserAgent,
  mockGoto,
  mockNewPage,
  mockLaunch,
} = vi.hoisted(() => {
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockContent = vi.fn().mockResolvedValue('<html><body>recipe</body></html>');
  const mockSetUserAgent = vi.fn().mockResolvedValue(undefined);
  const mockGoto = vi.fn().mockResolvedValue(undefined);
  const mockNewPage = vi.fn().mockResolvedValue({
    setUserAgent: mockSetUserAgent,
    goto: mockGoto,
    content: mockContent,
  });
  const mockLaunch = vi.fn().mockResolvedValue({
    newPage: mockNewPage,
    close: mockClose,
  });
  return { mockClose, mockContent, mockSetUserAgent, mockGoto, mockNewPage, mockLaunch };
});

vi.mock('puppeteer', () => ({
  default: { launch: mockLaunch },
}));

import { renderPage } from './browser.js';

describe('renderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    mockNewPage.mockResolvedValue({
      setUserAgent: mockSetUserAgent,
      goto: mockGoto,
      content: mockContent,
    });
    mockGoto.mockResolvedValue(undefined);
    mockContent.mockResolvedValue('<html><body>recipe</body></html>');
    mockClose.mockResolvedValue(undefined);
  });

  it('returns rendered html and empty imageCandidates', async () => {
    const result = await renderPage('https://example.com/recipe');

    expect(result.html).toBe('<html><body>recipe</body></html>');
    expect(result.imageCandidates).toEqual([]);
  });

  it('passes networkidle2 and 30s timeout to goto', async () => {
    await renderPage('https://example.com/recipe');

    expect(mockGoto).toHaveBeenCalledWith('https://example.com/recipe', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  });

  it('sets a realistic User-Agent header', async () => {
    await renderPage('https://example.com/recipe');

    expect(mockSetUserAgent).toHaveBeenCalledOnce();
    const [ua] = vi.mocked(mockSetUserAgent).mock.calls[0] as [string];
    expect(ua).toMatch(/Mozilla/);
  });

  it('closes the browser on success', async () => {
    await renderPage('https://example.com/recipe');

    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('closes the browser even when goto throws', async () => {
    mockGoto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

    await expect(renderPage('https://bad.url/')).rejects.toThrow(UserError);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('throws UserError when navigation fails', async () => {
    mockGoto.mockRejectedValue(new Error('Navigation timeout'));

    await expect(renderPage('https://example.com/')).rejects.toBeInstanceOf(UserError);
  });

  it('throws UserError when browser fails to launch', async () => {
    mockLaunch.mockRejectedValue(new Error('No usable sandbox'));

    await expect(renderPage('https://example.com/')).rejects.toBeInstanceOf(UserError);
  });

  it('throws UserError when page.content() fails', async () => {
    mockContent.mockRejectedValue(new Error('Execution context was destroyed'));

    await expect(renderPage('https://example.com/')).rejects.toBeInstanceOf(UserError);
  });

  it('closes the browser even when page.content() throws', async () => {
    mockContent.mockRejectedValue(new Error('Execution context was destroyed'));

    await expect(renderPage('https://example.com/')).rejects.toThrow(UserError);
    expect(mockClose).toHaveBeenCalledOnce();
  });
});
