import { parseUrl, checkReachable } from '../lib/url.js';
import { UserError } from '../lib/errors.js';
import { info } from '../lib/logger.js';
import { logFailure } from '../lib/failures.js';
import { renderPage } from '../services/browser.js';
import { extract } from '../services/extractor.js';
import { saveRecipe } from '../services/storage.js';
import { syncRecipe } from '../services/ftp.js';

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

  // Steps 2–4: URL is valid — any failure from here is logged to failures.log
  let recipeId: string;
  try {
    // Step 2: Check reachability — unreachable URLs are logged per spec
    await checkReachable(parsed.href);
    info(`Fetching recipe from: ${parsed.href}`);

    // Step 3 (FR-2): Render page and extract recipe via Claude
    const pageResult = await renderPage(parsed.href);
    const extracted = await extract(pageResult.html, parsed.href);
    info(`Extracted: ${extracted.title}`);

    // Step 4 (FR-5): Persist recipe to file-based database
    const recipe = await saveRecipe(extracted, parsed.href);
    info(`Saved recipe: ${recipe.id}`);
    recipeId = recipe.id;
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

  // Step 5 (FR-6): FTP sync — outside logFailure try/catch; FTP errors are deployment concerns
  if (options.ftp) {
    await syncRecipe(recipeId);
    info('FTP sync complete.');
  }
}
