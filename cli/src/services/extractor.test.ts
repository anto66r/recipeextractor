import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserError } from '../lib/errors.js';

const validExtractedRecipe = {
  title: 'Pasta Carbonara',
  description: 'A classic Roman pasta dish made with eggs, cheese, and guanciale.',
  originalServings: 2,
  servings: 4,
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  tags: ['Italian', 'dinner'],
  ingredients: [
    { quantity: '400g', item: 'spaghetti' },
    { quantity: '200g', item: 'guanciale' },
  ],
  steps: [
    'Bring a large pot of salted water to a boil.',
    'Cook the spaghetti until al dente.',
  ],
};

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

function makeClaudeResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

import { extract } from './extractor.js';

describe('extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns ExtractedRecipe on valid Claude response', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    const result = await extract('<html>recipe html</html>', 'https://example.com/');
    expect(result.title).toBe('Pasta Carbonara');
    expect(result.servings).toBe(4);
    expect(result.tags).toContain('Italian');
  });

  it('throws UserError when ANTHROPIC_API_KEY is not set', async () => {
    vi.unstubAllEnvs();
    delete process.env.ANTHROPIC_API_KEY;

    await expect(extract('<html></html>', 'https://example.com/')).rejects.toBeInstanceOf(
      UserError
    );
  });

  it('retries once on invalid JSON and succeeds on second attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(makeClaudeResponse('not valid json {{{'))
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(validExtractedRecipe)));

    const result = await extract('<html>recipe</html>', 'https://example.com/');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.title).toBe('Pasta Carbonara');
  });

  it('throws UserError after two invalid JSON responses', async () => {
    mockCreate.mockResolvedValue(makeClaudeResponse('not valid json {{{'));

    await expect(extract('<html>recipe</html>', 'https://example.com/')).rejects.toBeInstanceOf(
      UserError
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('throws UserError after two Zod validation failures', async () => {
    const badRecipe = { ...validExtractedRecipe, servings: 2 }; // servings must be 4
    mockCreate.mockResolvedValue(makeClaudeResponse(JSON.stringify(badRecipe)));

    await expect(extract('<html>recipe</html>', 'https://example.com/')).rejects.toBeInstanceOf(
      UserError
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles Claude response wrapped in markdown code fences', async () => {
    const fencedJson = '```json\n' + JSON.stringify(validExtractedRecipe) + '\n```';
    mockCreate.mockResolvedValue(makeClaudeResponse(fencedJson));

    const result = await extract('<html>recipe</html>', 'https://example.com/');
    expect(result.title).toBe('Pasta Carbonara');
  });

  it('handles Claude response wrapped in plain code fences', async () => {
    const fencedJson = '```\n' + JSON.stringify(validExtractedRecipe) + '\n```';
    mockCreate.mockResolvedValue(makeClaudeResponse(fencedJson));

    const result = await extract('<html>recipe</html>', 'https://example.com/');
    expect(result.title).toBe('Pasta Carbonara');
  });

  it('handles Claude response with preamble text before fenced JSON', async () => {
    const withPreamble =
      'Here is the extracted recipe:\n```json\n' +
      JSON.stringify(validExtractedRecipe) +
      '\n```';
    mockCreate.mockResolvedValue(makeClaudeResponse(withPreamble));

    const result = await extract('<html>recipe</html>', 'https://example.com/');
    expect(result.title).toBe('Pasta Carbonara');
  });

  it('retries once on transient API error and succeeds on second attempt', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce(makeClaudeResponse(JSON.stringify(validExtractedRecipe)));

    const result = await extract('<html>recipe</html>', 'https://example.com/');
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.title).toBe('Pasta Carbonara');
  });

  it('throws UserError after two Claude API errors', async () => {
    mockCreate.mockRejectedValue(new Error('503 Service Unavailable'));

    await expect(extract('<html>recipe</html>', 'https://example.com/')).rejects.toBeInstanceOf(
      UserError
    );
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('truncates HTML exceeding MAX_HTML_CHARS before sending to Claude', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    const largeHtml = '<html>' + 'x'.repeat(250_000) + '</html>';
    await extract(largeHtml, 'https://example.com/');

    const [call] = mockCreate.mock.calls;
    const userMessage = (call[0] as { messages: Array<{ content: string }> }).messages[0].content;
    // The injected HTML portion should be well under the raw input size
    expect(userMessage.length).toBeLessThan(250_000);
  });

  it('strips script tags from HTML before sending to Claude', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    const htmlWithScripts = '<html><script>alert(1)</script><body>recipe</body></html>';
    await extract(htmlWithScripts, 'https://example.com/');

    const [call] = mockCreate.mock.calls;
    const userMessage = (call[0] as { messages: Array<{ content: string }> }).messages[0].content;
    expect(userMessage).not.toContain('<script>');
    expect(userMessage).not.toContain('alert(1)');
    expect(userMessage).toContain('<body>recipe</body>');
  });

  it('strips style tags from HTML before sending to Claude', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    const htmlWithStyles = '<html><style>body { color: red; }</style><body>recipe</body></html>';
    await extract(htmlWithStyles, 'https://example.com/');

    const [call] = mockCreate.mock.calls;
    const userMessage = (call[0] as { messages: Array<{ content: string }> }).messages[0].content;
    expect(userMessage).not.toContain('<style>');
    expect(userMessage).not.toContain('color: red');
  });

  it('strips HTML comments before sending to Claude', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    const htmlWithComments = '<html><!-- ad tracker --><body>recipe</body></html>';
    await extract(htmlWithComments, 'https://example.com/');

    const [call] = mockCreate.mock.calls;
    const userMessage = (call[0] as { messages: Array<{ content: string }> }).messages[0].content;
    expect(userMessage).not.toContain('<!-- ad tracker -->');
    expect(userMessage).toContain('<body>recipe</body>');
  });

  it('includes the source URL in the Claude message', async () => {
    mockCreate.mockResolvedValue(
      makeClaudeResponse(JSON.stringify(validExtractedRecipe))
    );

    await extract('<html>recipe</html>', 'https://mysite.com/pasta');

    const [call] = mockCreate.mock.calls;
    const userMessage = (call[0] as { messages: Array<{ content: string }> }).messages[0].content;
    expect(userMessage).toContain('https://mysite.com/pasta');
  });
});
