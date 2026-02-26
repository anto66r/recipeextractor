import puppeteer from 'puppeteer';
import { UserError } from '../lib/errors.js';

export interface PageResult {
  html: string;
  imageCandidates: string[]; // populated in FR-11; always empty for FR-2
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function renderPage(url: string): Promise<PageResult> {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(
        `Failed to launch browser. Try reinstalling Puppeteer: npm install puppeteer\n${msg}`
      );
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(`Failed to load page: ${msg}`);
    }

    let html: string;
    try {
      html = await page.content();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new UserError(`Failed to retrieve page content: ${msg}`);
    }

    return { html, imageCandidates: [] };
  } finally {
    if (browser) {
      await browser.close().catch(() => {
        // ignore close errors — they must not mask the original error
      });
    }
  }
}
