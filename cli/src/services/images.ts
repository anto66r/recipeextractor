import { writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { RecipeImage } from '../types.js';
import { UserError } from '../lib/errors.js';

const IMAGES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../data/images'
);

interface DownloadedImage {
  data: Buffer;
  width: number;
  height: number;
  filename: string;
  alt: string;
}

export async function downloadImages(
  urls: string[],
  recipeId: string,
  recipeName: string,
): Promise<RecipeImage[]> {
  // Phase 1: download and process all images to memory — no file I/O yet
  const processed: DownloadedImage[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new UserError(`Image URL must start with http:// or https://: ${url}`);
    }

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(`Failed to fetch image (${url}): ${msg}`);
    }

    if (!response.ok) {
      throw new UserError(`Image URL returned HTTP ${response.status}: ${url}`);
    }

    let rawBuffer: Buffer;
    try {
      rawBuffer = Buffer.from(await response.arrayBuffer());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(`Failed to read image data (${url}): ${msg}`);
    }

    let data: Buffer;
    let width: number;
    let height: number;
    try {
      const result = await sharp(rawBuffer)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      data = result.data;
      width = result.info.width;
      height = result.info.height;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(`Failed to process image (${url}): ${msg}`);
    }

    processed.push({ data, width, height, filename: `${randomUUID()}.jpg`, alt: recipeName });
  }

  // Phase 2: all images ready — clear old dir and write atomically
  const outDir = resolve(IMAGES_DIR, recipeId);

  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  for (const img of processed) {
    await writeFile(resolve(outDir, img.filename), img.data);
  }

  return processed.map(({ filename, alt, width, height }) => ({
    filename,
    alt,
    width,
    height,
  }));
}
