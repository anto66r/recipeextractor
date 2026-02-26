import { UserError } from './errors.js';

export { UserError } from './errors.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; RecipeExtractor/0.1)';

export function parseUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UserError(`Invalid URL: "${raw}"`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new UserError(
      `URL must use http or https protocol (got "${parsed.protocol.replace(':', '')}")`
    );
  }

  return parsed;
}

export async function checkReachable(url: string): Promise<void> {
  let response: Response;
  try {
    // Use GET (not HEAD) — many recipe sites reject HEAD with 403/405
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    // Node.js fetch wraps OS errors under e.cause — prefer that for an actionable message
    const cause = e instanceof Error ? (e.cause as Error | undefined) : undefined;
    const reason = cause?.message ?? (e instanceof Error ? e.message : String(e));
    throw new UserError(`URL is unreachable: ${reason}`);
  }

  // Discard body — we only need the status code
  response.body?.cancel().catch(() => {});

  if (!response.ok) {
    throw new UserError(`URL returned HTTP ${response.status}: ${url}`);
  }
}
