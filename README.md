# Recipe Extractor

A personal recipe management system. Point it at any recipe URL and it extracts, normalizes, and stores the recipe — then makes it browsable from any device via a hosted web app.

## How it works

```
recipe add <url>
  │
  ├─ Validates URL and checks reachability
  ├─ Renders the page in a real Chrome browser (handles JS-heavy sites)
  ├─ Sends the rendered HTML to Claude AI
  ├─ Claude extracts and normalizes the recipe to 4 servings (metric units)
  ├─ Stores the result as JSON in data/recipes/
  └─ (FR-6) Syncs to Hostinger via FTP
```

## Prerequisites

- Node.js ≥ 20
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
git clone https://github.com/anto66r/recipeextractor.git
cd recipeextractor

# Install CLI dependencies (Puppeteer will download Chromium — ~170MB)
cd cli && npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Global install

A `recipe` wrapper script lives at the project root. Symlink it once to use `recipe` from anywhere:

```bash
ln -sf /path/to/recipeextractor/recipe /usr/local/bin/recipe
# then build the CLI once:
cd cli && npm run build
```

## Usage

```bash
# Extract a recipe
recipe add https://www.example.com/pasta-carbonara

# Skip FTP upload (offline mode)
recipe add https://www.example.com/pasta-carbonara --no-ftp

# Override or add tags
recipe add https://www.example.com/pasta-carbonara --tags "Italian,dinner,quick"

# During development (no build step)
cd cli && npm run dev add https://www.example.com/pasta-carbonara
```

On success the extracted recipe JSON is printed to stdout. Failures are logged to `logs/failures.log`.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |
| `FTP_HOST` | FR-6 | Hostinger FTP hostname |
| `FTP_USER` | FR-6 | FTP username |
| `FTP_PASS` | FR-6 | FTP password |
| `FTP_REMOTE_DATA_PATH` | FR-6 | Remote path for recipe data (default: `/data/recipes/`) |

Copy `.env.example` to `.env` at the project root. The file is gitignored.

## Recipe JSON schema

All recipes are stored as `data/recipes/<uuid>.json`:

```json
{
  "schemaVersion": 2,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "pasta-carbonara",
  "title": "Pasta Carbonara",
  "description": "Classic Roman pasta dish with eggs, cheese, and guanciale.",
  "sourceUrl": "https://www.example.com/pasta-carbonara",
  "originalServings": 2,
  "servings": 4,
  "prepTime": "10 minutes",
  "cookTime": "20 minutes",
  "tags": ["Italian", "dinner", "quick"],
  "images": [],
  "ingredients": [
    { "quantity": "400g", "item": "spaghetti" }
  ],
  "steps": [
    "Bring a large pot of salted water to a boil.",
    "Cook the spaghetti until al dente."
  ],
  "createdAt": "2026-02-26T12:00:00Z"
}
```

Recipes are always normalized to **4 servings**. Measurements are converted to metric (g, ml, L, kg) — except `tsp`, `tbsp`, `pinch`, and `dash` which are kept as-is.

## Development

```bash
cd cli

npm test          # run all unit tests (vitest)
npm run typecheck # TypeScript type check
npm run build     # compile to dist/
```

All tests use mocked Puppeteer and mocked Anthropic SDK — no browser is launched and no API calls are made during `npm test`.

## Project structure

```
recipeextractor/
├── recipe                  # Global wrapper script (symlink to /usr/local/bin/recipe)
├── cli/                    # CLI tool (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts        # Entry point
│   │   ├── commands/add.ts # `recipe add` handler
│   │   ├── services/
│   │   │   ├── browser.ts  # Puppeteer page rendering
│   │   │   ├── extractor.ts# Claude AI extraction
│   │   │   ├── storage.ts  # JSON file persistence
│   │   │   └── ftp.ts      # FTP sync to Hostinger
│   │   └── lib/
│   │       ├── schema.ts   # Zod validation schemas
│   │       ├── failures.ts # Failure log writer
│   │       ├── errors.ts   # UserError class
│   │       ├── logger.ts   # stdout/stderr helpers
│   │       └── url.ts      # URL validation
│   └── package.json
├── viewer/                 # Recipe viewer (PHP + React/Vite)
│   ├── src/                # React frontend
│   └── php/                # PHP API endpoints
├── data/
│   ├── recipes/            # JSON recipe files + index.json
│   └── images/             # Downloaded recipe images
├── logs/
│   └── failures.log        # Failed extraction log
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
└── .env.example
```

## Story status

| ID | Feature | Status |
|---|---|---|
| FR-1 | Submit a recipe URL | Done |
| FR-2 | Extract recipe via Claude AI | Done |
| FR-3 | Normalize to 4 servings | Done (part of FR-2) |
| FR-4 | Auto-tag recipes | Done (part of FR-2) |
| FR-5 | Store in file-based DB | Done |
| FR-6 | Sync to Hostinger via FTP | Done |
| FR-7 | Browse recipe collection | In progress |
| FR-8 | View recipe detail | Pending |
| FR-9 | Rescale servings in viewer | Pending |
| FR-10 | Deploy viewer on PR merge | Pending |
| FR-11 | Extract and store recipe images | In progress |
| FR-12 | Backfill images for existing recipes | In progress |
