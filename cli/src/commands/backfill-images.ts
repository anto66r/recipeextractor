import { readIndex, readRecipe, updateRecipeImages } from '../services/storage.js';
import { renderPage } from '../services/browser.js';
import { downloadImages } from '../services/images.js';
import { syncRecipe } from '../services/ftp.js';
import { info, warn } from '../lib/logger.js';
import { UserError } from '../lib/errors.js';

export interface BackfillOptions {
  dryRun: boolean;
  id?: string;
  ftp: boolean;
}

const INTER_REQUEST_DELAY_MS = 1500;

export async function backfillImagesCommand(options: BackfillOptions): Promise<void> {
  const index = await readIndex();

  // Identify candidates: recipes where images is empty or absent
  let candidates = index.filter((e) => !e.images || e.images.length === 0);

  if (options.id) {
    const target = index.find((e) => e.id === options.id);
    if (!target) {
      throw new UserError(`No recipe found with id: ${options.id}`);
    }
    if (target.images && target.images.length > 0) {
      info(`Recipe "${target.title}" already has images — skipping.`);
      return;
    }
    candidates = candidates.filter((e) => e.id === options.id);
  }

  if (candidates.length === 0) {
    info('All recipes already have images.');
    return;
  }

  info(`Found ${candidates.length} recipe(s) missing images.`);

  if (options.dryRun) {
    for (const entry of candidates) {
      info(`[dry-run] Would backfill: "${entry.title}" (${entry.id})`);
    }
    return;
  }

  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    info(`\n[${i + 1}/${candidates.length}] "${entry.title}"`);
    try {
      const recipe = await readRecipe(entry.id);
      const { imageCandidates } = await renderPage(recipe.sourceUrl);
      const images = await downloadImages(imageCandidates, entry.id, entry.title);

      if (images.length === 0) {
        warn('  no image found');
      } else {
        await updateRecipeImages(entry.id, images);
        info(`  found ${images.length} image(s)`);

        if (options.ftp) {
          try {
            await syncRecipe(entry.id);
            info('  FTP sync complete.');
          } catch (e) {
            warn(`  FTP sync failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    } catch (err) {
      warn(`  failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Rate-limit between page fetches (skip delay after last entry)
    if (i < candidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
    }
  }
}
