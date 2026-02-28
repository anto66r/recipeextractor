import { UserError } from '../lib/errors.js';
import { info } from '../lib/logger.js';
import { readIndex, updateRecipeImages } from '../services/storage.js';
import { downloadImages } from '../services/images.js';
import { syncRecipe } from '../services/ftp.js';

export interface SetImagesOptions {
  ftp: boolean;
}

export async function setImagesCommand(
  uuid: string,
  urls: string[],
  options: SetImagesOptions,
): Promise<void> {
  // Validate recipe exists
  const index = await readIndex();
  const entry = index.find((e) => e.id === uuid);
  if (!entry) {
    throw new UserError(`Recipe not found: ${uuid}`);
  }

  info(`Setting images for: ${entry.title}`);

  // Download + process all images (fails completely on any error — no partial state)
  const images = await downloadImages(urls, uuid, entry.title);
  info(`Processed ${images.length} image(s).`);

  // Update recipe JSON + index
  await updateRecipeImages(uuid, images);
  info(`Updated recipe: ${uuid}`);

  // FTP sync
  if (options.ftp) {
    await syncRecipe(uuid);
    info('FTP sync complete.');
  }
}
