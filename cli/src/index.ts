#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { addCommand } from './commands/add.js';
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

// parseAsync handles async action handlers; UserError bubbles up here for a clean exit
program.parseAsync().catch((e: unknown) => {
  if (e instanceof UserError) {
    logError(e.message);
    process.exit(1);
  }
  // Unexpected errors get a stack trace
  throw e;
});
