import { parseUrl, checkReachable } from '../lib/url.js';
import { UserError } from '../lib/errors.js';
import { info } from '../lib/logger.js';

export interface AddOptions {
  // Populated by --tags <tags>; merged with auto-tags in FR-4
  tags?: string;
  // false when --no-ftp is passed; consumed by FTP sync in FR-6
  ftp: boolean;
}

export async function addCommand(url: string, _options: AddOptions): Promise<void> {
  // Step 1: Validate URL format — throws UserError on failure (caught in index.ts)
  const parsed = parseUrl(url);

  // Step 2: Check reachability — throws UserError on failure
  await checkReachable(parsed.href);

  // FR-1: Confirm URL is valid and reachable
  info(`Fetching recipe from: ${parsed.href}`);

  // Extraction (FR-2), storage (FR-5), and FTP sync (FR-6) will be added in subsequent stories
}
