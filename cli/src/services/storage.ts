import { writeFile, rename, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { ExtractedRecipe } from '../lib/schema.js';
import type { Recipe, RecipeIndex } from '../types.js';
import { UserError } from '../lib/errors.js';
import { info } from '../lib/logger.js';

// cli/src/services/ → ../../../data/recipes (project root)
const DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../data/recipes'
);
const INDEX_PATH = resolve(DATA_DIR, 'index.json');

export type PromptFn = (question: string) => Promise<string>;

export function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function readIndex(): Promise<RecipeIndex[]> {
  if (!existsSync(INDEX_PATH)) return [];
  const raw = await readFile(INDEX_PATH, 'utf8');
  return JSON.parse(raw) as RecipeIndex[];
}

async function writeIndex(entries: RecipeIndex[]): Promise<void> {
  const tmp = `${INDEX_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(entries, null, 2), 'utf8');
  await rename(tmp, INDEX_PATH);
}

async function atomicWriteRecipe(id: string, recipe: Recipe): Promise<void> {
  const filePath = resolve(DATA_DIR, `${id}.json`);
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, JSON.stringify(recipe, null, 2), 'utf8');
  await rename(tmp, filePath);
}

export function defaultPrompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function saveRecipe(
  extracted: ExtractedRecipe,
  sourceUrl: string,
  prompt: PromptFn = defaultPrompt,
): Promise<Recipe> {
  await mkdir(DATA_DIR, { recursive: true });

  const index = await readIndex();

  const existing = index.find((e) => e.sourceUrl === sourceUrl);
  if (existing) {
    const answer = await prompt(
      `Recipe from this URL already exists ("${existing.title}"). Overwrite? [y/N] `
    );
    if (answer !== 'y' && answer !== 'yes') {
      throw new UserError('Skipped: recipe already exists for this URL.');
    }
    const oldIndex = index.findIndex((e) => e.sourceUrl === sourceUrl);
    index.splice(oldIndex, 1);
  }

  const id = randomUUID();
  // Slug is not guaranteed unique — id is the primary key. Slug is for human-readable URLs only.
  const slug = makeSlug(extracted.title);
  const createdAt = new Date().toISOString();

  const recipe: Recipe = {
    schemaVersion: 2,
    id,
    slug,
    title: extracted.title,
    description: extracted.description,
    sourceUrl,
    originalServings: extracted.originalServings,
    servings: 4,
    prepTime: extracted.prepTime,
    cookTime: extracted.cookTime,
    tags: extracted.tags,
    images: [],
    ingredients: extracted.ingredients,
    steps: extracted.steps,
    createdAt,
  };

  await atomicWriteRecipe(id, recipe);

  const indexEntry: RecipeIndex = {
    id,
    slug,
    title: recipe.title,
    tags: recipe.tags,
    images: [],
    sourceUrl,
    createdAt,
  };
  index.push(indexEntry);
  await writeIndex(index);

  info(`Saved: ${recipe.title} → data/recipes/${id}.json`);
  return recipe;
}
