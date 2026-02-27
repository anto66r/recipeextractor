import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'puppeteer';
import sharp from 'sharp';
import type { RecipeImage } from '../types.js';
import { warn } from '../lib/logger.js';

export interface ImageCandidate {
  url: string;
  alt: string;
}

const IMAGES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../data/images'
);

// Minimum image area (px²) to filter out icons/logos in the largest-<img> heuristic
const MIN_IMAGE_AREA = 10000;

// Maximum number of images to save per recipe
const MAX_IMAGES = 2;

export async function extractCandidates(page: Page): Promise<ImageCandidate[]> {
  try {
    return await page.evaluate(() => {
      const candidates: Array<{ url: string; alt: string }> = [];
      const seen = new Set<string>();

      // Named resolveUrl to avoid shadowing the Node.js path.resolve import at module scope
      function resolveUrl(url: string): string {
        try {
          return new URL(url, window.location.href).href;
        } catch {
          return '';
        }
      }

      function add(url: string, alt: string): void {
        if (!url) return;
        const resolved = resolveUrl(url);
        if (!resolved.startsWith('http') || seen.has(resolved)) return;
        seen.add(resolved);
        candidates.push({ url: resolved, alt });
      }

      // Priority 1: og:image
      const ogImage = document.querySelector<HTMLMetaElement>(
        'meta[property="og:image"]'
      );
      if (ogImage?.content) add(ogImage.content, '');

      // Priority 2: schema.org/Recipe JSON-LD image
      const ldScripts = document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      );
      for (const script of ldScripts) {
        try {
          const data = JSON.parse(script.textContent ?? '');
          const nodes = Array.isArray(data) ? data : [data];
          for (const node of nodes) {
            const types: string[] = Array.isArray(node['@type'])
              ? node['@type']
              : [node['@type'] ?? ''];
            if (!types.some((t) => t === 'Recipe')) continue;
            const img = node['image'];
            if (!img) break;
            if (typeof img === 'string') {
              add(img, '');
            } else if (Array.isArray(img)) {
              const first = img[0];
              add(typeof first === 'string' ? first : first?.url ?? '', '');
            } else if (typeof img === 'object' && img.url) {
              add(img.url, '');
            }
            break;
          }
        } catch {
          // malformed JSON — skip
        }
      }

      // Priority 3: largest <img> by naturalWidth * naturalHeight
      if (candidates.length < 2) {
        const containers = document.querySelectorAll<HTMLElement>(
          'article, main, [class*="recipe"], [id*="recipe"]'
        );
        const scope: NodeListOf<HTMLImageElement> =
          containers.length > 0
            ? containers[0].querySelectorAll('img')
            : document.querySelectorAll('img');

        let bestImg: HTMLImageElement | null = null;
        let bestArea = MIN_IMAGE_AREA;

        for (const img of scope) {
          const area = img.naturalWidth * img.naturalHeight;
          if (area > bestArea) {
            bestArea = area;
            bestImg = img;
          }
        }

        if (bestImg?.src) {
          add(bestImg.src, bestImg.alt ?? '');
        }
      }

      return candidates.slice(0, 5);
    });
  } catch {
    return [];
  }
}

export async function downloadImages(
  candidates: ImageCandidate[],
  recipeId: string,
  recipeName: string,
): Promise<RecipeImage[]> {
  const outDir = resolve(IMAGES_DIR, recipeId);
  const saved: RecipeImage[] = [];

  for (const candidate of candidates) {
    if (saved.length >= MAX_IMAGES) break;

    if (!candidate.url.startsWith('http://') && !candidate.url.startsWith('https://')) {
      warn(`Images: skipping non-http URL: ${candidate.url}`);
      continue;
    }

    try {
      const response = await fetch(candidate.url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        warn(`Images: HTTP ${response.status} for ${candidate.url}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const index = saved.length;
      const filename = `${index}.jpg`;
      const outPath = resolve(outDir, filename);

      // Use resolveWithObject to get dimensions from the pipeline without a second decode pass
      const { data: processed, info } = await sharp(buffer)
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true });

      // Create directory lazily — only once, on first successful image
      if (saved.length === 0) {
        await mkdir(outDir, { recursive: true });
      }

      await writeFile(outPath, processed);

      saved.push({
        filename,
        alt: candidate.alt || recipeName,
        width: info.width,
        height: info.height,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warn(`Images: failed to download ${candidate.url}: ${msg}`);
    }
  }

  return saved;
}
