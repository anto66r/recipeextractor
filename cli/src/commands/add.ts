import { parseUrl, checkReachable } from '../lib/url.js';
import { UserError } from '../lib/errors.js';
import { info, warn } from '../lib/logger.js';
import { logFailure } from '../lib/failures.js';
import { renderPage, type ImageCandidate } from '../services/browser.js';
import { extract } from '../services/extractor.js';
import { saveRecipe, updateRecipeImages } from '../services/storage.js';
import { syncRecipe } from '../services/ftp.js';
import { downloadImages } from '../services/images.js';

export interface AddOptions {
  // Populated by --tags <tags>; merged with auto-tags in FR-4
  tags?: string;
  // false when --no-ftp is passed; consumed by FTP sync in FR-6
  ftp: boolean;
  // false when --no-images is passed; consumed by image service in FR-11
  images: boolean;
}

export async function addCommand(url: string, options: AddOptions): Promise<void> {
  // Step 1: Validate URL format — throws UserError on failure (not logged; no valid URL yet)
  const parsed = parseUrl(url);

  // Steps 2–5: URL is valid — any failure from here is logged to failures.log
  let recipeId: string;
  let recipeTitle: string;
  let imageCandidates: ImageCandidate[] = [];
  try {
    // Step 2: Check reachability — unreachable URLs are logged per spec
    await checkReachable(parsed.href);
    info(`Fetching recipe from: ${parsed.href}`);

    // Step 3 (FR-2): Render page and extract recipe via Claude
    const pageResult = await renderPage(parsed.href);
    imageCandidates = pageResult.imageCandidates;
    const extracted = await extract(pageResult.html, parsed.href);
    info(`Extracted: ${extracted.title}`);

    // Step 4 (FR-5): Persist recipe to file-based database
    const recipe = await saveRecipe(extracted, parsed.href);
    info(`Saved recipe: ${recipe.id}`);
    recipeId = recipe.id;
    recipeTitle = recipe.title;
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    // logFailure is best-effort; don't let its failure mask the original error
    try {
      await logFailure(parsed.href, reason);
    } catch {
      // intentionally ignored
    }
    throw e;
  }

  // Step 5 (FR-11): Download and store images — non-fatal; recipe is already saved
  if (options.images && imageCandidates.length > 0) {
    try {
      const savedImages = await downloadImages(imageCandidates, recipeId, recipeTitle);
      if (savedImages.length > 0) {
        await updateRecipeImages(recipeId, savedImages);
        info(`Images: saved ${savedImages.length} image(s).`);
      }
    } catch {
      warn('Image extraction failed — recipe saved without images.');
    }
  }

  // Step 6 (FR-6): FTP sync — outside logFailure try/catch; FTP errors are deployment concerns
  if (options.ftp) {
    await syncRecipe(recipeId);
    info('FTP sync complete.');
  }
}
