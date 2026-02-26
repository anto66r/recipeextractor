import Anthropic from '@anthropic-ai/sdk';
import { UserError } from '../lib/errors.js';
import { ExtractedRecipeSchema, ExtractedRecipe, TAG_VALUES } from '../lib/schema.js';

const MAX_HTML_CHARS = 200_000;

const SYSTEM_PROMPT =
  'You are a recipe extraction assistant. Your only task is to extract and normalize ' +
  'recipe data from HTML. You always return valid JSON and nothing else. ' +
  'Do not include markdown code fences, prose, explanations, or apologies. ' +
  'Return only the JSON object.';

function buildUserMessage(html: string, sourceUrl: string): string {
  const trimmedHtml = trimHtml(html);
  const finalHtml =
    trimmedHtml.length > MAX_HTML_CHARS
      ? trimmedHtml.slice(0, MAX_HTML_CHARS)
      : trimmedHtml;

  return `Extract the recipe from the HTML below and return a single JSON object matching this exact schema:

{
  "title": string,
  "description": string (1-3 sentences about the dish),
  "originalServings": number (the serving count as written on the page),
  "servings": 4,
  "prepTime": string (e.g. "15 minutes"; use "unknown" if not stated),
  "cookTime": string (e.g. "30 minutes"; use "unknown" if not stated),
  "tags": string[] (max 6, chosen only from the taxonomy below),
  "ingredients": [{ "quantity": string, "item": string }],
  "steps": string[]
}

NORMALIZATION RULES:
- Scale all ingredient quantities so the recipe serves exactly 4 people. Set servings to 4.
- Convert all measurements to metric EXCEPT: tsp, tbsp, pinch, dash — keep those as-is.
- Weight: use g (under 1000g) or kg (1000g and above).
- Volume: use ml (under 1000ml) or L (1000ml and above).
- Rewrite each step as a clear, concise sentence in plain English.
- Do not include step numbers in the step strings themselves (they are array entries).
- If prepTime or cookTime is not stated on the page, use "unknown".

TAG TAXONOMY (choose up to 6, use exact strings only):
${TAG_VALUES.join(', ')}

SOURCE URL: ${sourceUrl}

HTML:
${finalHtml}`;
}

function trimHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new UserError(
      'ANTHROPIC_API_KEY is not set. Add it to your .env file or environment.'
    );
  }
  return key;
}

async function callClaude(client: Anthropic, userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned an unexpected response format.');
  }
  return block.text;
}

function stripFences(raw: string): string {
  // Extract content between the first and last ``` fence (handles preamble text before the fence)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
}

function parseResponse(raw: string): ExtractedRecipe {
  const cleaned = stripFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 500)}`);
  }
  return ExtractedRecipeSchema.parse(parsed);
}

export async function extract(html: string, sourceUrl: string): Promise<ExtractedRecipe> {
  const client = new Anthropic({ apiKey: getApiKey() });
  const userMessage = buildUserMessage(html, sourceUrl);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(client, userMessage);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === 1) continue; // retry once on transient API errors
      throw new UserError(`Claude API error: ${lastError.message}`);
    }

    try {
      return parseResponse(raw);
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === 1) continue; // retry once on parse/validation failures
    }
  }

  throw new UserError(
    `Failed to extract a valid recipe after 2 attempts. Last error: ${lastError?.message ?? 'unknown'}`
  );
}
