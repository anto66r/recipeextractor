# CLAUDE.md — Recipe Extractor

Instructions for Claude Code when working on this project.

## Project overview

Two-part system:
1. **CLI** (`cli/`) — Node.js/TypeScript tool. Run `recipe add <url>` to extract, normalize, and store a recipe.
2. **Viewer** (`viewer/`) — PHP + React/Vite app hosted on Hostinger. Scaffolded in FR-7.

Shared data contract: flat JSON files under `data/recipes/` and `data/images/`.

## Dev commands (run from `cli/`)

```bash
npm test            # vitest (unit tests only — no browser launched)
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
npm run dev         # run CLI via tsx (no compile step)
```

To run the CLI during development:
```bash
node --loader tsx src/index.ts add <url>
# or after build:
node dist/index.js add <url>
# or via the global wrapper (after symlinking recipe → /usr/local/bin/recipe):
recipe add <url>
```

## Dev commands (run from `viewer/`)

```bash
npm run typecheck   # tsc --noEmit
npm run build       # Vite production build → viewer/dist/
npm run dev         # Vite dev server (proxies /api/* to localhost:8080)
```

Local dev with PHP API:
```bash
# Terminal 1: PHP API server (from project root)
export DATA_DIR=$(pwd)/data
php -S localhost:8080 -t viewer/php viewer/php/index.php

# Terminal 2: Vite dev server
cd viewer && npm run dev
```

## Environment setup

Copy `.env.example` to `.env` at the project root and fill in values:
```
ANTHROPIC_API_KEY=sk-ant-...
FTP_HOST=
FTP_USER=
FTP_PASS=
FTP_REMOTE_DATA_PATH=/data/recipes/
```

`dotenv` is loaded in `index.ts` and resolves `.env` relative to the script file's location (not `cwd`), so the CLI works from any directory.

## Branch convention

```
[feature|bug]/[storyId]-[short-description]
```
Example: `feature/FR-2-extract-recipe`

Always branch off `main`. Open a PR back to `main`.

## Story workflow (implement-story skill)

Use `/implement-story <FR-N>` to run the full implementation workflow:
Phase 1 (prep) → Phase 2 (plan + user approval) → Phase 3 (implement) → Phase 4 (QA) → Phase 5 (commit + PR).

## Architecture decisions to respect

- **`UserError`** (`lib/errors.ts`) — all user-facing errors. Caught at top level in `index.ts` and printed cleanly. Internal/unexpected errors use plain `Error` and surface as stack traces.
- **`process.exit`** only in `index.ts`. Never call it inside services or commands.
- **`logFailure`** (`lib/failures.ts`) — call for any failure that occurs after `parseUrl()` succeeds. It is best-effort: wrap it in try/catch and always re-throw the original error.
- **`browser.close()`** must be in a `finally` block with `.catch(() => {})` to never mask the original error.
- **Retry policy** (`extractor.ts`) — retry once on both API transport errors and JSON parse/Zod validation failures. Throw `UserError` on second failure.
- **HTML trimming** — strip `<script>`, `<style>`, and HTML comments before sending to Claude to reduce token count.
- **Fence stripping** — Claude sometimes wraps JSON in markdown fences; `stripFences()` handles fences with or without preamble text.
- **`dotenv`** loaded eagerly in `index.ts`; API key validated lazily inside `extractor.ts`.

## Testing conventions

- Test framework: **Vitest**
- Mock modules with `vi.mock('../path/to/module.js')` (always include `.js` extension)
- Mock top-level variables used inside `vi.mock()` factories with `vi.hoisted()`
- Mock globals with `vi.stubGlobal()` / `vi.unstubAllGlobals()`
- Stub env vars with `vi.stubEnv()` / `vi.unstubAllEnvs()`
- No integration tests — all tests run with mocked Puppeteer and mocked Anthropic SDK
- Test files live alongside the source file they test (e.g., `browser.test.ts` next to `browser.ts`)

## CLI source structure

```
cli/src/
  index.ts              # Entry point — Commander setup, dotenv, UserError boundary
  commands/
    add.ts              # `recipe add <url>` handler
  services/
    browser.ts          # Puppeteer CDP: renderPage() → { html, imageCandidates }
    extractor.ts        # Claude API: extract() → ExtractedRecipe
    storage.ts          # saveRecipe() / updateRecipeImages() → data/recipes/
    ftp.ts              # syncRecipe(id) → uploads to Hostinger via basic-ftp
  lib/
    errors.ts           # UserError class
    failures.ts         # logFailure() → logs/failures.log
    logger.ts           # info(), warn(), error() to stdout/stderr
    schema.ts           # Zod schemas: ExtractedRecipeSchema, IngredientSchema
    url.ts              # parseUrl(), checkReachable()
  types.ts              # Recipe, RecipeIndex, RecipeImage (schemaVersion 2)
```

## Story status

| Story | Description | Status |
|---|---|---|
| FR-1 | Submit URL | Done (PR #22) |
| FR-2 | Extract via Claude | Done (PR #23) |
| FR-3 | Normalize to 4 servings | Included in FR-2 Claude prompt |
| FR-4 | Auto-tag | Included in FR-2 Claude prompt |
| FR-5 | File-based DB storage | Done (PR #24) |
| FR-6 | FTP sync on add | Done (PR #26) |
| FR-7 | Browse collection (viewer) | In PR #25 |
| FR-8 | View recipe detail (viewer) | Pending |
| FR-9 | Rescale servings (viewer) | Pending |
| FR-10 | Deploy viewer on PR merge | Pending |
| FR-11 | Extract and store images | In PR #29 |
| FR-12 | Backfill images for existing recipes | In PR #30 |
| FR-13 | Submit Recipe URL from Viewer | In PR #33 |

## What to avoid

- Never call `process.exit()` outside `index.ts`
- Never commit `.env` (it is gitignored)
- Never add `--no-verify` to git commands
- Do not write to `data/` during tests — mock the storage service
- Do not run Puppeteer in tests — mock the `browser` module
