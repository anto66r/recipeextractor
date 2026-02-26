import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('[]'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}));

import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import { makeSlug, readIndex, saveRecipe } from './storage.js';
import { UserError } from '../lib/errors.js';
import type { ExtractedRecipe } from '../lib/schema.js';

const mockExtracted: ExtractedRecipe = {
  title: 'Pasta Carbonara',
  description: 'Classic Roman pasta dish.',
  originalServings: 2,
  servings: 4,
  prepTime: '10 minutes',
  cookTime: '20 minutes',
  tags: ['Italian', 'dinner'],
  ingredients: [{ quantity: '400g', item: 'spaghetti' }],
  steps: ['Boil water.', 'Cook pasta.'],
};

const SOURCE_URL = 'https://example.com/pasta-carbonara';

describe('makeSlug', () => {
  it('converts spaces to hyphens', () => {
    expect(makeSlug('Pasta Carbonara')).toBe('pasta-carbonara');
  });

  it('lowercases the string', () => {
    expect(makeSlug('PASTA')).toBe('pasta');
  });

  it('strips special characters', () => {
    expect(makeSlug("Mom's Cookies!")).toBe('moms-cookies');
  });

  it('collapses multiple spaces', () => {
    expect(makeSlug('one   two')).toBe('one-two');
  });

  it('collapses multiple hyphens', () => {
    expect(makeSlug('one--two')).toBe('one-two');
  });

  it('trims leading and trailing hyphens', () => {
    expect(makeSlug('  pasta  ')).toBe('pasta');
  });
});

describe('readIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when index file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await readIndex();
    expect(result).toEqual([]);
  });

  it('returns parsed entries when index file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const entries = [{ id: '1', slug: 'test', title: 'Test', tags: [], images: [], sourceUrl: 'https://x.com', createdAt: '2026-01-01T00:00:00.000Z' }];
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(entries) as any);
    const result = await readIndex();
    expect(result).toEqual(entries);
  });
});

describe('saveRecipe', () => {
  const mockPrompt = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fsp.readFile).mockResolvedValue('[]' as any);
    mockPrompt.mockResolvedValue('n');
  });

  it('writes recipe JSON atomically (tmp then rename, in that order)', async () => {
    const sequence: string[] = [];
    vi.mocked(fsp.writeFile).mockImplementation(async (path) => {
      sequence.push(`write:${String(path)}`);
    });
    vi.mocked(fsp.rename).mockImplementation(async (from) => {
      sequence.push(`rename:${String(from)}`);
    });

    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);

    const writePos = sequence.findIndex(
      (s) => s.startsWith('write:') && s.includes('test-uuid-1234.json.tmp')
    );
    const renamePos = sequence.findIndex(
      (s) => s.startsWith('rename:') && s.includes('test-uuid-1234.json.tmp')
    );
    expect(writePos).toBeGreaterThanOrEqual(0);
    expect(renamePos).toBeGreaterThan(writePos);
  });

  it('writes index.json atomically (tmp then rename, in that order)', async () => {
    const sequence: string[] = [];
    vi.mocked(fsp.writeFile).mockImplementation(async (path) => {
      sequence.push(`write:${String(path)}`);
    });
    vi.mocked(fsp.rename).mockImplementation(async (from) => {
      sequence.push(`rename:${String(from)}`);
    });

    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);

    const writePos = sequence.findIndex(
      (s) => s.startsWith('write:') && s.includes('index.json.tmp')
    );
    const renamePos = sequence.findIndex(
      (s) => s.startsWith('rename:') && s.includes('index.json.tmp')
    );
    expect(writePos).toBeGreaterThanOrEqual(0);
    expect(renamePos).toBeGreaterThan(writePos);
  });

  it('sets schemaVersion: 2 on the recipe', async () => {
    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);

    const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
    const recipeCall = writeFileCalls.find(([path]) =>
      (path as string).includes('test-uuid-1234.json.tmp')
    );
    const written = JSON.parse(recipeCall![1] as string);
    expect(written.schemaVersion).toBe(2);
  });

  it('sets images: [] on the recipe', async () => {
    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);

    const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
    const recipeCall = writeFileCalls.find(([path]) =>
      (path as string).includes('test-uuid-1234.json.tmp')
    );
    const written = JSON.parse(recipeCall![1] as string);
    expect(written.images).toEqual([]);
  });

  it('generates a uuid for recipe.id', async () => {
    const recipe = await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
    expect(recipe.id).toBe('test-uuid-1234');
  });

  it('generates a slug from the title', async () => {
    const recipe = await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
    expect(recipe.slug).toBe('pasta-carbonara');
  });

  it('sets createdAt to an ISO 8601 string', async () => {
    const recipe = await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
    expect(recipe.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('appends an entry to index.json with sourceUrl', async () => {
    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);

    const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
    const indexCall = writeFileCalls.find(([path]) =>
      (path as string).includes('index.json.tmp')
    );
    const indexEntries = JSON.parse(indexCall![1] as string);
    expect(indexEntries).toHaveLength(1);
    expect(indexEntries[0].sourceUrl).toBe(SOURCE_URL);
    expect(indexEntries[0].id).toBe('test-uuid-1234');
  });

  it('creates data/recipes directory recursively', async () => {
    await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
    expect(fsp.mkdir).toHaveBeenCalledWith(expect.stringContaining('data/recipes'), { recursive: true });
  });

  describe('duplicate detection', () => {
    const existingEntry = {
      id: 'old-uuid',
      slug: 'pasta-carbonara',
      title: 'Pasta Carbonara',
      tags: ['Italian'],
      images: [],
      sourceUrl: SOURCE_URL,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify([existingEntry]) as any);
    });

    it('prompts user when sourceUrl already exists in index', async () => {
      mockPrompt.mockResolvedValue('n');
      await expect(saveRecipe(mockExtracted, SOURCE_URL, mockPrompt)).rejects.toThrow(UserError);
      expect(mockPrompt).toHaveBeenCalledOnce();
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.stringContaining('already exists')
      );
    });

    it('overwrites when user answers "y"', async () => {
      mockPrompt.mockResolvedValue('y');
      const recipe = await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
      expect(recipe.id).toBe('test-uuid-1234');

      // Old entry removed, new entry written
      const writeFileCalls = vi.mocked(fsp.writeFile).mock.calls;
      const indexCall = writeFileCalls.find(([path]) =>
        (path as string).includes('index.json.tmp')
      );
      const indexEntries = JSON.parse(indexCall![1] as string);
      expect(indexEntries).toHaveLength(1);
      expect(indexEntries[0].id).toBe('test-uuid-1234');
    });

    it('overwrites when user answers "yes"', async () => {
      mockPrompt.mockResolvedValue('yes');
      const recipe = await saveRecipe(mockExtracted, SOURCE_URL, mockPrompt);
      expect(recipe.id).toBe('test-uuid-1234');
    });

    it('throws UserError when user answers "n"', async () => {
      mockPrompt.mockResolvedValue('n');
      await expect(saveRecipe(mockExtracted, SOURCE_URL, mockPrompt)).rejects.toThrow(UserError);
    });

    it('throws UserError when user answers "" (default skip)', async () => {
      mockPrompt.mockResolvedValue('');
      await expect(saveRecipe(mockExtracted, SOURCE_URL, mockPrompt)).rejects.toThrow(UserError);
    });
  });
});
