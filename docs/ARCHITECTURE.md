# Architecture Document
# Recipe Extractor & Viewer

**Version:** 1.1
**Date:** 2026-02-26
**Author:** Application Architect (AI Agent)
**PRD Reference:** `docs/PRD.md` v1.2

---

## 1. System Overview

The system consists of two independently deployable components that share a common data contract (the Recipe JSON schema):

```
┌─────────────────────────────────────────────────────────────┐
│                        Local Machine                         │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │               CLI Tool (Node.js/TS)                    │ │
│  │                                                        │ │
│  │  recipe add <url>                                      │ │
│  │       │                                                │ │
│  │  1. Validate URL                                       │ │
│  │  2. Puppeteer (CDP) → navigate, render, get HTML       │ │
│  │  3. Extract image candidates from live DOM             │ │
│  │  4. Claude API → extract + normalize + tag (HTML in)   │ │
│  │  5. Download + resize images → data/images/<uuid>/     │ │
│  │  6. Atomic write → data/recipes/<uuid>.json            │ │
│  │  7. Update data/recipes/index.json                     │ │
│  │  8. FTP upload (recipe + images + index) → Hostinger   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  data/recipes/         ← JSON recipe files                  │
│  data/images/          ← Downloaded recipe images           │
│  logs/failures.log                                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ FTP
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                          Hostinger                           │
│                                                             │
│  /data/recipes/     ← JSON files (CLI-managed)              │
│  /data/images/      ← Image files (CLI-managed)             │
│  /public_html/      ← Recipe Viewer                         │
│    ├── index.php    ← SPA entrypoint / router               │
│    ├── api/         ← PHP data API endpoints                 │
│    └── assets/      ← Vite-built React bundle               │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │ FTP (GitHub Actions)
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions (CI/CD)                       │
│  Trigger: push to main                                      │
│  1. npm run build  (Vite)                                   │
│  2. FTP upload public_html/ → Hostinger                     │
│  (never touches /data/recipes/ or /data/images/)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```
recipeextractor/
├── cli/                        # CLI Tool (Node.js/TypeScript)
│   ├── src/
│   │   ├── index.ts            # Entry point — registers commands, handles UserError at top level
│   │   ├── commands/
│   │   │   └── add.ts          # `recipe add <url>` command handler
│   │   ├── services/
│   │   │   ├── browser.ts      # Puppeteer lifecycle (launch, navigate, get HTML, close)
│   │   │   ├── images.ts       # Image candidate extraction + download + resize (sharp)
│   │   │   ├── extractor.ts    # Claude API integration
│   │   │   ├── storage.ts      # Atomic file writes + index management
│   │   │   └── ftp.ts          # FTP sync via basic-ftp
│   │   ├── lib/
│   │   │   ├── errors.ts       # UserError class (shared recoverable error type)
│   │   │   ├── logger.ts       # stdout / stderr / failures.log
│   │   │   ├── schema.ts       # Zod schema for Recipe type
│   │   │   └── url.ts          # parseUrl() + checkReachable()
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
│   │   │   ├── RecipeCard.tsx  # Thumbnail image + title + tags
│   │   │   ├── TagFilter.tsx
│   │   │   ├── RecipeImage.tsx # Hero image with fallback placeholder
│   │   │   └── ServingScaler.tsx
│   │   ├── hooks/
│   │   │   └── useScaledIngredients.ts
│   │   └── types.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── data/
│   └── recipes/                # File-based recipe database
│       ├── index.json
│       └── <uuid>.json
│   └── images/                 # Downloaded recipe images
│       └── <uuid>/
│           ├── 1.jpg           # Primary (hero) image
│           └── 2.jpg           # Secondary image (optional)
│
├── logs/
│   └── failures.log
│
├── .github/
│   └── workflows/
│       └── deploy-viewer.yml   # FR-10
│
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
│
└── .env                        # Local secrets (gitignored)
```

---

## 3. Technology Stack

| Layer | Technology | Version Guidance |
|---|---|---|
| CLI runtime | Node.js | ≥ 20 LTS |
| CLI language | TypeScript | ≥ 5.x, strict mode |
| CLI framework | Commander.js | v12+ |
| Browser automation | Puppeteer | v22+ (bundles Chromium) |
| AI integration | Anthropic SDK (`@anthropic-ai/sdk`) | latest |
| AI model | `claude-sonnet-4-6` | |
| Schema validation | Zod | v3 |
| Image processing | `sharp` | v0.33+ |
| FTP client | `basic-ftp` | v5 |
| HTML parsing | Puppeteer DOM API (no separate parser needed) | |
| Viewer frontend | React + Vite | React 18, Vite 5 |
| Viewer backend | PHP | 8.1+ |
| CI/CD | GitHub Actions | |
| FTP deploy action | `SamKirkland/FTP-Deploy-Action` | v4 |

---

## 4. Data Contract: Recipe JSON Schema

All components must conform to this schema (`schemaVersion: 2`).

```typescript
interface RecipeImage {
  filename: string;   // "1.jpg" or "2.jpg"
  alt: string;        // Image alt text (extracted from img[alt] or page title)
  width: number;      // Pixels after resize
  height: number;
}

interface Ingredient {
  quantity: string;
  item: string;
}

interface Recipe {
  schemaVersion: 2;
  id: string;             // UUID v4
  slug: string;
  title: string;
  description: string;
  sourceUrl: string;
  originalServings: number;
  servings: 4;            // Always stored normalized to 4
  prepTime: string;
  cookTime: string;
  tags: string[];         // Max 6
  images: RecipeImage[];  // 0–2 images; empty array if none extracted
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;      // ISO 8601
}
```

**Index entry** (`index.json`):

```typescript
interface RecipeIndex {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  images: RecipeImage[];  // Included so the browse page can show thumbnails without loading each recipe
  createdAt: string;
}
```

### Unit Rules

| Type | Rule |
|---|---|
| Weight | Convert to `g` or `kg` |
| Volume (large) | Convert to `ml` or `L` |
| Small-measure | Keep as `tsp`, `tbsp`, `pinch`, `dash` |

---

## 5. CLI Architecture

### 5.1 Command Invocation

```
recipe add <url> [--tags tag1,tag2] [--no-ftp] [--no-images]
```

### 5.2 Execution Flow

```
add.ts
  │
  ├── validateUrl(url)                        [lib/url.ts]
  │     └── throws UserError on invalid/unreachable
  │
  ├── browser.renderPage(url)                 [services/browser.ts]
  │     ├── puppeteer.launch({ headless: true })
  │     ├── page.goto(url, { waitUntil: 'networkidle2' })
  │     ├── page.content() → rendered HTML string
  │     ├── images.extractCandidates(page)    [services/images.ts]
  │     │     ├── 1. <meta property="og:image"> content
  │     │     ├── 2. JSON-LD schema.org/Recipe > image
  │     │     └── 3. Largest visible <img> in recipe content area
  │     └── browser.close()
  │     returns: { html: string, imageCandidates: string[] }
  │
  ├── extractor.extract(html, url)            [services/extractor.ts]
  │     ├── Send Claude API message with extraction prompt + rendered HTML
  │     ├── Claude returns JSON matching Recipe schema (minus images)
  │     ├── Validate response with Zod
  │     └── returns: Partial<Recipe>
  │
  ├── images.download(candidates, recipeId)   [services/images.ts]
  │     ├── Download up to 2 images (HTTP GET)
  │     ├── Resize to max 1200px longest side (sharp)
  │     ├── Save as JPEG quality 85 → data/images/<uuid>/1.jpg [, 2.jpg]
  │     └── returns: RecipeImage[]  (empty array if none downloaded)
  │
  ├── storage.checkDuplicate(sourceUrl)       [services/storage.ts]
  │     └── Prompt to overwrite/skip if URL exists
  │
  ├── storage.save(recipe)                    [services/storage.ts]
  │     ├── Write data/images/<uuid>/ (already on disk from images.download)
  │     ├── Write data/recipes/<uuid>.json.tmp → rename (atomic)
  │     └── Append entry to data/recipes/index.json
  │
  └── ftp.sync(recipe.id)                    [services/ftp.ts]  [unless --no-ftp]
        ├── Upload data/recipes/<uuid>.json
        ├── Upload data/images/<uuid>/ (all files)
        └── Upload data/recipes/index.json
```

### 5.3 Browser Service (`services/browser.ts`)

```typescript
// Key responsibilities:
// - Manage Puppeteer browser lifecycle (singleton per CLI invocation)
// - Set realistic User-Agent before navigation
// - Wait for networkidle2 to ensure JS-rendered content is present
// - Return rendered HTML + hand off the page object for image extraction
// - Always close browser on success or error (try/finally)

interface PageResult {
  html: string;
  imageCandidates: string[]; // Up to 5 candidate image URLs, in priority order
}
```

### 5.4 Image Service (`services/images.ts`)

**Candidate extraction (from live Puppeteer page):**

```
Priority 1: <meta property="og:image"> content attribute
Priority 2: JSON-LD script[type="application/ld+json"] → Recipe.image (first if array)
Priority 3: Largest <img> element by naturalWidth × naturalHeight
            (filtered to elements within article/main/[class*=recipe])
```

**Download + resize:**

```
For each candidate (max 2 downloads):
  1. fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
  2. Pipe to sharp()
     .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
     .jpeg({ quality: 85 })
     .toFile(`data/images/<uuid>/<n>.jpg`)
  3. Record { filename, alt, width, height } from sharp metadata
```

If an image download fails, skip it and try the next candidate. Image failure is non-fatal.

### 5.5 Error Handling

| Scenario | Behavior |
|---|---|
| Invalid URL format | Print error to stderr; exit 1; no log entry |
| URL unreachable | Print error to stderr; append to failures.log; exit 1 |
| Puppeteer navigation fails | Print error to stderr; append to failures.log; exit 1 |
| Chrome not installed | `puppeteer` bundles Chromium — no external dependency |
| Claude API error | Print error to stderr; append to failures.log; exit 1 |
| Claude returns malformed JSON | Retry once; log + exit 1 on second failure |
| Image download fails | Skip that image; continue (non-fatal) |
| FTP upload failure | Print warning to stderr; local data NOT rolled back; exit 0 |
| Duplicate URL (user skips) | Print info to stdout; exit 0 cleanly |

### 5.6 Claude Extraction Prompt Design

The prompt must instruct Claude to:
1. Extract recipe content from rendered HTML (JS-rendered; cleaner than raw HTML)
2. Normalize all ingredients to serve exactly 4 people
3. Convert units to metric (except tsp/tbsp/pinch/dash)
4. Rewrite steps as clear, numbered plain English
5. Assign up to 6 tags from the defined taxonomy
6. Return **only** valid JSON matching the Recipe schema — no prose

---

## 6. Viewer Architecture

### 6.1 PHP Layer Responsibilities

1. **SPA routing fallback** — `index.php` serves Vite-built `index.html` for non-API routes
2. **Data API** — reads JSON + serves image URLs from `/data/` (above web root)

```
GET /api/recipes              → php/api/recipes.php  → index.json
GET /api/recipe?id=<uuid>     → php/api/recipe.php   → <uuid>.json
GET /data/images/<uuid>/1.jpg → served directly by PHP/web server from /data/images/
```

**Security note:** PHP endpoints validate `id` against `/^[0-9a-f-]{36}$/` before constructing file paths.

### 6.2 Image Serving on Hostinger

The `/data/` directory is above `public_html`. Images are served via a PHP pass-through endpoint or via a symbolic link / alias. Recommended approach: create a read-only PHP endpoint `api/image.php?id=<uuid>&n=<1|2>` that streams the image file with correct Content-Type headers. This keeps images behind validated paths.

### 6.3 React Application Structure

```
App.tsx
  ├── Route "/"           → BrowsePage
  │     ├── Fetches /api/recipes (index — includes images[])
  │     ├── TagFilter (client-side)
  │     └── RecipeCard list
  │           └── RecipeImage (thumbnail from images[0], placeholder if none)
  │
  └── Route "/recipe/:slug" → RecipePage
        ├── Fetches /api/recipe?id=<id>
        ├── RecipeImage (hero — images[0], full width)
        ├── ServingScaler (+/- stepper, range 1–20)
        ├── Ingredient list (scaled via useScaledIngredients)
        ├── Steps (numbered; images[1] displayed after step 3 if present)
        └── Tag chips
```

### 6.4 RecipeImage Component

```typescript
// RecipeImage.tsx
// Props: images: RecipeImage[], index: 0 | 1, className?: string
// - Renders <img> with src pointing to /api/image?id=<recipeId>&n=<index+1>
// - Shows a neutral placeholder SVG if images[index] is undefined
// - Uses loading="lazy" for all non-hero images
```

---

## 7. Deployment Architecture

### 7.1 CLI FTP Sync (runtime, FR-6)

- After every successful `recipe add`
- Uploads: `data/recipes/<uuid>.json`, `data/images/<uuid>/` (all files), `data/recipes/index.json`
- `--no-ftp` disables for offline use
- Image upload failures are non-fatal (local data preserved)

### 7.2 Viewer Deploy (GitHub Actions, FR-10)

```yaml
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
        (excludes /data/ — managed by CLI only)
```

### 7.3 Hostinger Directory Layout

```
/
├── data/                           ← Above web root; not directly accessible
│   ├── recipes/
│   │   ├── index.json
│   │   └── <uuid>.json
│   └── images/
│       └── <uuid>/
│           ├── 1.jpg
│           └── 2.jpg
└── public_html/                    ← Web root
    ├── index.php
    ├── api/
    │   ├── recipes.php
    │   ├── recipe.php
    │   └── image.php               ← Streams images from /data/images/ safely
    └── assets/
        ├── index-<hash>.js
        └── index-<hash>.css
```

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

---

## 9. Tag Taxonomy

**Meal type:** `breakfast`, `lunch`, `dinner`, `snack`, `dessert`, `drink`

**Dietary:** `vegetarian`, `vegan`, `gluten-free`, `dairy-free`, `nut-free`, `low-carb`

**Cuisine:** `Italian`, `Asian`, `Mexican`, `Mediterranean`, `American`, `French`, `Indian`, `Middle Eastern`, `Japanese`, `Thai`

**Attribute:** `quick`, `meal-prep`, `one-pot`, `batch-cooking`, `comfort-food`

Maximum 6 tags per recipe. User-supplied `--tags` values take priority.

---

## 10. Implementation Sequencing

```
FR-1 (done) → services/browser.ts → FR-2 → FR-3 → FR-5 → FR-6
                      ↓
                FR-11 (images) ─────────────────────────┘
                (can be done in same pass as FR-2/5/6)

FR-4 (auto-tag) runs in same Claude call as FR-2/3

FR-5 → FR-7 → FR-8 → FR-9

FR-10 (independent; needs viewer/ to be buildable)
```

**Recommended build order:**

1. `services/browser.ts` — Puppeteer wrapper (prerequisite for FR-2 and FR-11)
2. `FR-2` + `FR-3` + `FR-4` — Claude integration (single API call)
3. `FR-11` — Image extraction + resize (piggybacks on browser session from FR-2)
4. `FR-5` — Storage layer (now includes images; schema v2)
5. `FR-6` — FTP sync (now includes image directories)
6. `FR-7` + `FR-8` — Viewer browse + detail (with image display)
7. `FR-9` — Serving scaler
8. `FR-10` — GitHub Actions deploy

---

## 11. Architectural Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Recipe sites reject automated browsers (bot detection) | Medium | Puppeteer with realistic User-Agent + `networkidle2`; document that some sites will still fail |
| Puppeteer Chromium startup time adds 3–5s per invocation | High | Accept the trade-off; browser launch is unavoidable for JS rendering; consider keeping browser open if batch mode is added later |
| Claude returns structurally invalid JSON | Low | Zod validation + one retry; log + graceful exit on second failure |
| FTP credentials accidentally committed | Low | `.gitignore` enforced; `.env.example` committed instead |
| Path traversal via `id` param in PHP API | Low | Validate against `/^[0-9a-f-]{36}$/` before file path construction |
| Image download from external CDN is slow or throttled | Medium | 10s timeout per image; skip and continue on failure |
| `sharp` native binary not available on CI | Low | `sharp` provides prebuilt binaries for all major platforms via npm |
| Puppeteer Chromium version incompatible with OS | Low | Puppeteer bundles its own Chromium; no system dependency |
| FTP partial failure (recipe uploaded, images not) | Low | Upload recipe last (after images); FTP failure is non-blocking to local state |
| Serving scaler float precision errors | Medium | Use integer arithmetic with rational numbers for ingredient scaling |

---

*This document was produced by the application-architect agent based on PRD v1.2.*
