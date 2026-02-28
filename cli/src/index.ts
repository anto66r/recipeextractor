#!/usr/bin/env node
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

// Resolve .env relative to this file's location (cli/src/ → ../../ = project root)
// This works regardless of the working directory when the CLI is invoked
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });
import { addCommand } from './commands/add.js';
import { setImagesCommand } from './commands/set-images.js';
import { UserError } from './lib/errors.js';
import { error as logError } from './lib/logger.js';

const program = new Command();

program
  .name('recipe')
  .description('CLI tool for extracting and managing recipes from the web')
  .version('0.1.0');

program
  .command('add <url>')
  .description('Extract and store a recipe from a URL')
  .option('--tags <tags>', 'Comma-separated tags to add or override auto-tags')
  .option('--no-ftp', 'Skip FTP upload after saving')
  .option('--no-images', 'Skip image extraction')
  .action(addCommand);

program
  .command('set-images <uuid> <url...>')
  .description('Download and store image URLs for an existing recipe')
  .option('--no-ftp', 'Skip FTP upload after saving')
  .action(setImagesCommand);

// parseAsync handles async action handlers; UserError bubbles up here for a clean exit
program.parseAsync().catch((e: unknown) => {
  if (e instanceof UserError) {
    logError(e.message);
    process.exit(1);
  }
  // Unexpected errors get a stack trace
  throw e;
});
