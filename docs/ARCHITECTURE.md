# Architecture Document
# Recipe Extractor & Viewer

**Version:** 1.0
**Date:** 2026-02-26
**Author:** Application Architect (AI Agent)
**PRD Reference:** `docs/PRD.md` v1.1

---

## 1. System Overview

The system consists of two independently deployable components that share a common data contract (the Recipe JSON schema):

```
┌─────────────────────────────────────────────────────────┐
│                      Local Machine                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │              CLI Tool (Node.js/TS)               │  │
│  │                                                  │  │
│  │  recipe add <url>                                │  │
│  │       │                                          │  │
│  │  1. Validate URL                                 │  │
│  │  2. Fetch page HTML                              │  │
│  │  3. Claude API → extract + normalize + tag       │  │
│  │  4. Atomic write → data/recipes/<uuid>.json      │  │
│  │  5. Update data/recipes/index.json               │  │
│  │  6. FTP upload (recipe + index) → Hostinger      │  │
│  └──────────────────────────────────────────────────┘  │
│                           │                             │
│                    data/recipes/                        │
│                    logs/failures.log                    │
└───────────────────────────┼─────────────────────────────┘
                            │ FTP
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       Hostinger                          │
│                                                         │
│  /data/recipes/          ← JSON files (CLI-managed)     │
│  /public_html/           ← Recipe Viewer                │
│    ├── index.php         ← SPA entrypoint / router      │
│    ├── api/              ← PHP data API endpoints        │
│    └── assets/           ← Vite-built React bundle      │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ FTP (GitHub Actions)
┌─────────────────────────────────────────────────────────┐
│               GitHub Actions (CI/CD)                     │
│  Trigger: push to main                                  │
│  1. npm run build  (Vite)                               │
│  2. FTP upload public_html/ → Hostinger                 │
│  (never touches /data/recipes/)                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```
recipeextractor/
├── cli/                        # CLI Tool (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts            # Entry point — registers commands
│   │   ├── commands/
│   │   │   └── add.ts          # `recipe add <url>` command handler
│   │   ├── services/
│   │   │   ├── fetcher.ts      # URL fetch + HTML extraction
│   │   │   ├── extractor.ts    # Claude API integration
│   │   │   ├── storage.ts      # Atomic file writes + index management
│   │   │   └── ftp.ts          # FTP sync via basic-ftp
│   │   ├── lib/
│   │   │   ├── logger.ts       # stdout / stderr / failures.log
│   │   │   ├── schema.ts       # Zod schema for Recipe type
│   │   │   └── slug.ts         # URL → slug generation
│   │   └── types.ts            # Shared TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── viewer/                     # Recipe Viewer (PHP + React/Vite)
│   ├── php/
│   │   ├── index.php           # SPA shell + PHP routing fallback
│   │   └── api/
│   │       ├── recipes.php     # GET /api/recipes → serves index.json
│   │       └── recipe.php      # GET /api/recipe?id=<uuid> → serves <uuid>.json
│   ├── src/                    # React (Vite) source
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── BrowsePage.tsx  # FR-7: recipe list + tag filter
│   │   │   └── RecipePage.tsx  # FR-8 + FR-9: detail + serving scaler
│   │   ├── components/
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── TagFilter.tsx
│   │   │   └── ServingScaler.tsx
│   │   ├── hooks/
│   │   │   └── useScaledIngredients.ts  # Serving-scale calculation logic
│   │   └── types.ts            # Recipe interface (mirrors CLI schema)
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── data/
│   └── recipes/                # File-based database
│       ├── index.json          # Recipe index (id, title, tags, slug, createdAt)
│       └── <uuid>.json         # Individual recipe files
│
├── logs/
│   └── failures.log            # Append-only failure log
│
├── .github/
│   └── workflows/
│       └── deploy-viewer.yml   # FR-10: Build + FTP deploy on push to main
│
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md         # This document
│
└── .env                        # Local secrets (gitignored)
```

---

## 3. Technology Stack

| Layer | Technology | Version Guidance |
|---|---|---|
| CLI runtime | Node.js | ≥ 20 LTS |
| CLI language | TypeScript | ≥ 5.x, strict mode |
| CLI framework | [Commander.js](https://github.com/tj/commander.js) | v12+ |
| AI integration | Anthropic SDK (`@anthropic-ai/sdk`) | latest |
| AI model | `claude-sonnet-4-6` | |
| Schema validation | Zod | v3 |
| FTP client | `basic-ftp` | v5 |
| HTML parsing | Node.js `fetch` + `node-html-parser` or Cheerio | |
| Viewer frontend | React + Vite | React 18, Vite 5 |
| Viewer backend | PHP | 8.1+ (Hostinger provides) |
| CI/CD | GitHub Actions | |
| FTP deploy action | `SamKirkland/FTP-Deploy-Action` | v4 |

---

## 4. Data Contract: Recipe JSON Schema

All components must conform to this schema (`schemaVersion: 1`).

```typescript
interface Recipe {
  schemaVersion: 1;
  id: string;             // UUID v4
  slug: string;           // URL-safe, derived from title
  title: string;
  description: string;
  sourceUrl: string;
  originalServings: number;
  servings: 4;            // Always stored normalized to 4
  prepTime: string;       // Human-readable, e.g. "10 minutes"
  cookTime: string;
  tags: string[];         // Max 6; from defined taxonomy
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;      // ISO 8601
}

interface Ingredient {
  quantity: string;       // e.g. "400g", "2 tbsp", "pinch"
  item: string;           // e.g. "spaghetti", "salt"
}
```

**Index entry** (stored in `index.json` as an array):

```typescript
interface RecipeIndex {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  createdAt: string;
}
```

### Unit Rules (enforced by Claude prompt)

| Type | Rule |
|---|---|
| Weight | Convert to `g` or `kg` |
| Volume (large) | Convert to `ml` or `L` |
| Small-measure | Keep as `tsp`, `tbsp`, `pinch`, `dash` |

---

## 5. CLI Architecture

### 5.1 Command Invocation

```
recipe add <url> [--tags tag1,tag2] [--no-ftp]
```

### 5.2 Execution Flow

```
add.ts
  │
  ├── validateUrl(url)
  │     └── throws UserError on invalid/unreachable
  │
  ├── fetcher.fetchPage(url)
  │     ├── fetch(url, { headers: { 'User-Agent': ... } })
  │     └── returns: raw HTML string
  │
  ├── extractor.extract(html, url)
  │     ├── Sends Claude API message with structured extraction prompt
  │     ├── Claude responds with JSON matching Recipe schema
  │     ├── Validates response with Zod schema
  │     └── Returns: Recipe object (servings already normalized to 4)
  │
  ├── storage.checkDuplicate(sourceUrl)
  │     ├── Reads index.json
  │     └── Prompts to overwrite/skip if URL exists
  │
  ├── storage.save(recipe)
  │     ├── Write to data/recipes/<uuid>.json.tmp
  │     ├── fs.rename() → data/recipes/<uuid>.json  (atomic)
  │     └── Append entry to data/recipes/index.json
  │
  └── ftp.sync(recipe.id)  [unless --no-ftp]
        ├── Upload data/recipes/<uuid>.json
        └── Upload data/recipes/index.json
```

### 5.3 Error Handling

| Scenario | Behavior |
|---|---|
| Invalid URL format | Print error to stderr; exit code 1; no log entry |
| URL unreachable | Print error to stderr; append to `logs/failures.log`; exit 1 |
| Claude API error | Print error to stderr; append to `logs/failures.log`; exit 1 |
| Claude returns malformed JSON | Retry once; if still invalid, log + exit 1 |
| FTP upload failure | Print warning to stderr; local data is **not** rolled back; exit 0 |
| Duplicate URL (user skips) | Print info to stdout; exit 0 cleanly |

**failures.log format:**
```
[2026-02-26T12:34:56Z] FAILED url=https://... reason="Claude returned invalid JSON after retry"
```

### 5.4 Claude Extraction Prompt Design

The prompt must instruct Claude to:
1. Extract recipe content from HTML, ignoring ads/nav/comments
2. Normalize all ingredients to serve exactly 4 people
3. Convert units to metric (except tsp/tbsp/pinch/dash)
4. Rewrite steps as clear, concise, numbered plain English
5. Assign up to 6 tags from the defined taxonomy
6. Return **only** valid JSON matching the Recipe schema — no prose

The prompt should include the Zod schema as a JSON Schema type definition for maximum fidelity.

---

## 6. Viewer Architecture

### 6.1 PHP Layer Responsibilities

PHP handles two concerns only:
1. **SPA routing fallback** — `index.php` serves the Vite-built `index.html` for all non-API routes, enabling client-side React Router navigation
2. **Data API** — reads JSON files from `/data/recipes/` (outside `public_html`) and returns them as JSON responses

```
GET /api/recipes         → php/api/recipes.php  → reads index.json
GET /api/recipe?id=<id>  → php/api/recipe.php   → reads <uuid>.json
```

**Security note:** PHP API endpoints must validate the `id` parameter is a valid UUID before constructing file paths, to prevent path traversal.

### 6.2 React Application Structure

```
App.tsx
  ├── Route "/"         → BrowsePage
  │     ├── Fetches /api/recipes (index)
  │     ├── TagFilter component (client-side filter)
  │     └── RecipeCard list → links to /recipe/:slug
  │
  └── Route "/recipe/:slug" → RecipePage
        ├── Fetches /api/recipe?id=<id>  (looks up id from slug via index)
        ├── ServingScaler component (default: 4)
        │     └── +/- stepper, range [1–20]
        └── Ingredient list scaled via useScaledIngredients(ingredients, scale)
```

### 6.3 Serving Scaler Logic

```typescript
// useScaledIngredients.ts
// scale = currentServings / 4  (4 is the stored baseline)
// Quantities are parsed from strings like "400g", "2 tbsp", "1/3 cup"
// tsp/tbsp/pinch/dash quantities are scaled numerically
// Fractional results use fraction.js or a small utility to display as ⅓, ½ etc.
```

The scaler operates entirely client-side; URLs do not change on rescale (FR-9).

---

## 7. Deployment Architecture

### 7.1 CLI FTP Sync (runtime, FR-6)

- Triggered after every successful `recipe add`
- Uses `basic-ftp` with passive mode
- Credentials read from `.env`: `FTP_HOST`, `FTP_USER`, `FTP_PASS`, `FTP_REMOTE_DATA_PATH`
- Only uploads: the new recipe file + updated `index.json`
- `--no-ftp` flag disables for offline use

### 7.2 Viewer Deploy (GitHub Actions, FR-10)

```yaml
# .github/workflows/deploy-viewer.yml
on:
  push:
    branches: [main]
    paths:
      - 'viewer/**'

jobs:
  deploy:
    steps:
      - checkout
      - npm ci && npm run build  (in viewer/)
      - FTP upload viewer/dist/ + viewer/php/ → /public_html/
        (excludes /data/recipes/ — managed by CLI only)
```

Secrets required in GitHub repository settings: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.

### 7.3 Hostinger Directory Layout

```
/
├── data/
│   └── recipes/                ← CLI-managed; outside web root
│       ├── index.json
│       └── <uuid>.json
└── public_html/                ← Web root
    ├── index.php               ← SPA shell
    ├── api/
    │   ├── recipes.php
    │   └── recipe.php
    └── assets/                 ← Vite build output
        ├── index-<hash>.js
        └── index-<hash>.css
```

The `/data/` directory sits **above** `public_html` so recipe JSON files are not directly web-accessible (they are served only through the PHP API).

---

## 8. Configuration & Secrets

| Config Key | Used By | Source |
|---|---|---|
| `ANTHROPIC_API_KEY` | CLI extractor | `.env` (local) |
| `FTP_HOST` | CLI FTP sync | `.env` (local) |
| `FTP_USER` | CLI FTP sync | `.env` (local) |
| `FTP_PASS` | CLI FTP sync | `.env` (local) |
| `FTP_REMOTE_DATA_PATH` | CLI FTP sync | `.env` (local) |
| `FTP_HOST` | GitHub Actions deploy | GitHub Secret |
| `FTP_USER` | GitHub Actions deploy | GitHub Secret |
| `FTP_PASS` | GitHub Actions deploy | GitHub Secret |

`.env.example` is committed; `.env` is gitignored.

---

## 9. Tag Taxonomy

Claude auto-tagging must draw exclusively from this set:

**Meal type:** `breakfast`, `lunch`, `dinner`, `snack`, `dessert`, `drink`

**Dietary:** `vegetarian`, `vegan`, `gluten-free`, `dairy-free`, `nut-free`, `low-carb`

**Cuisine:** `Italian`, `Asian`, `Mexican`, `Mediterranean`, `American`, `French`, `Indian`, `Middle Eastern`, `Japanese`, `Thai`

**Attribute:** `quick`, `meal-prep`, `one-pot`, `batch-cooking`, `comfort-food`

Maximum 6 tags per recipe. User-supplied `--tags` values are merged in, replacing auto-tags if count would exceed 6 (user tags take priority).

---

## 10. Implementation Sequencing

Dependencies between stories that must inform sprint planning:

```
FR-1 → FR-2 → FR-3 → FR-5 → FR-6
                ↓
              FR-4 (can be done in same Claude call as FR-2/3)

FR-5 → FR-7 → FR-8 → FR-9

FR-10 (independent; only requires viewer/ directory to exist)
```

**Recommended build order:**

1. `FR-5` — Storage layer first (defines schema; everything else depends on it)
2. `FR-1` — URL validation and CLI scaffolding
3. `FR-2` + `FR-3` + `FR-4` — Claude integration (single API call covers all three)
4. `FR-6` — FTP sync (add after core loop works)
5. `FR-7` + `FR-8` — Viewer browse + detail (PHP API + React skeleton)
6. `FR-9` — Serving scaler (builds on FR-8)
7. `FR-10` — GitHub Actions deploy (configure last; needs viewer to be buildable)

---

## 11. Architectural Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Anti-scraping blocks on recipe sites | Medium | Set realistic `User-Agent`; use `Accept` headers; document that some sites will fail |
| Claude returns structurally invalid JSON | Low | Zod validation + one retry; log + graceful exit on second failure |
| FTP credentials in `.env` accidentally committed | Low | `.gitignore` enforced; `.env.example` committed instead |
| Path traversal via `id` param in PHP API | Low | Validate `id` against `/^[0-9a-f-]{36}$/` before file path construction |
| FTP upload partial failure (file uploaded, index not) | Low | Upload recipe file first, then index; FTP failure is non-blocking to local state |
| Hostinger PHP version mismatch | Low | Target PHP 8.1 (widely available on shared hosting); document requirement |
| Serving scaler float precision errors | Medium | Use `fraction.js` or integer arithmetic with rational numbers for ingredient scaling |

---

*This document was produced by the application-architect agent based on PRD v1.1.*
