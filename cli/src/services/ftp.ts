import { Client } from 'basic-ftp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserError } from '../lib/errors.js';
import { info } from '../lib/logger.js';

// Same path derivation pattern as storage.ts
const DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../data/recipes'
);

interface FtpCredentials {
  host: string;
  user: string;
  password: string;
  remotePath: string;
}

function getCredentials(): FtpCredentials {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  const remotePath = process.env.FTP_REMOTE_DATA_PATH;

  if (!host || !user || !password || !remotePath) {
    throw new UserError(
      'FTP credentials are not fully configured. Set FTP_HOST, FTP_USER, FTP_PASS, and FTP_REMOTE_DATA_PATH in .env. Use --no-ftp to skip.'
    );
  }

  return { host, user, password, remotePath };
}

export async function syncRecipe(id: string): Promise<void> {
  const { host, user, password, remotePath } = getCredentials();
  const client = new Client();

  try {
    await client.access({ host, user, password, secure: true, secureOptions: { rejectUnauthorized: false } });
    await client.ensureDir(remotePath);

    const recipeFile = resolve(DATA_DIR, `${id}.json`);
    const indexFile = resolve(DATA_DIR, 'index.json');

    await client.uploadFrom(recipeFile, `${id}.json`);
    info(`FTP: uploaded ${id}.json`);

    await client.uploadFrom(indexFile, 'index.json');
    info(`FTP: uploaded index.json`);
  } catch (e: unknown) {
    if (e instanceof UserError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new UserError(`FTP upload failed: ${msg}`);
  } finally {
    client.close();
  }
}
