# Product Requirements Document
# Recipe Extractor & Viewer

**Version:** 1.1
**Date:** 2026-02-26
**Author:** Product Manager (AI Agent)
**Reviewed by:** Application Architect (AI Agent)

---

## 1. Overview

A two-part system for extracting, normalizing, storing, and browsing recipes from the web:

1. **CLI Extractor** — a local command-line tool that accepts a URL, uses Claude AI to extract and normalize the recipe, stores it in a local file-based database, and syncs the result to a Hostinger hosting account via FTP.
2. **Recipe Viewer** — a PHP/React web application hosted on Hostinger that displays stored recipes and allows serving-size rescaling. Deployed automatically via FTP when a PR is merged to `main`.

---

## 2. Goals

- Eliminate manual recipe copying and reformatting
- Maintain a personal, portable recipe collection in a well-structured format
- Make the collection browsable and usable from any device via a hosted web app
- Keep infrastructure lightweight: no cloud database, no containers, no CI/CD pipeline beyond FTP

---

## 3. Non-Goals

- Multi-user support
- Authentication / login for the viewer
- Native mobile app
- Real-time collaboration

---

## 4. System Architecture

```
[Local Machine]
    │
    ├── CLI tool (Node.js or PHP CLI)
    │       │
    │       ├── Fetch URL content
    │       ├── Claude API → extract + normalize recipe
    │       ├── Auto-tag recipe
    │       ├── Write to local file-based DB (JSON files)
    │       └── FTP sync → Hostinger /data/recipes/
    │
[Hostinger]
    ├── /data/recipes/          ← JSON recipe files (synced via FTP)
    └── /public_html/           ← Recipe Viewer (PHP + React)
                                    Deployed via FTP on PR merge to main
```

---

## 5. User Stories

### Epic 1: CLI Recipe Extractor

---

**FR-1: Submit a Recipe URL**

> As a user, I can run `recipe add <url>` so that the system fetches and begins processing the recipe at that URL.

- **Complexity:** S
- **Priority:** P0
- **Acceptance Criteria:**
  - CLI accepts a single URL argument
  - CLI validates the URL format before proceeding
  - An error message is shown if the URL is unreachable or invalid
  - On success, a processing confirmation message is printed to stdout

---

**FR-2: Extract Recipe via Claude AI**

> As a user, I can have Claude automatically extract the recipe content from a URL so that I don't have to copy and paste it manually.

- **Complexity:** M
- **Priority:** P0
- **Acceptance Criteria:**
  - The page content is fetched (handling common anti-scraping patterns where possible)
  - The raw HTML/text is sent to Claude with a structured extraction prompt
  - Claude returns a normalized recipe object with: `title`, `description`, `ingredients`, `steps`, `prepTime`, `cookTime`, `servings` (normalized to 4)
  - If extraction fails, a clear error is shown, nothing is written to disk, and the failure is appended to `logs/failures.log`

---

**FR-3: Normalize Recipe to 4 Servings**

> As a user, I can have all recipes automatically normalized to 4 servings so that I have a consistent baseline for cooking.

- **Complexity:** M
- **Priority:** P0
- **Acceptance Criteria:**
  - All ingredient quantities are scaled to serve exactly 4 people
  - The original serving size is preserved in the stored record (`originalServings`)
  - Scaling logic handles fractions and unit conversions (e.g., "1/3 cup" scaled correctly)
  - All volumetric and weight measurements are converted to metric (g, ml, L, kg) **except** small-measure cooking units: `tsp`, `tbsp`, `pinch`, `dash`, which are kept as-is
  - Claude is instructed to rewrite steps to be clear, concise, and in plain English

---

**FR-4: Auto-Tag Recipes**

> As a user, I can have recipes automatically tagged with relevant categories so that I can browse and filter by cuisine, meal type, or dietary preference.

- **Complexity:** S
- **Priority:** P1
- **Acceptance Criteria:**
  - Claude assigns tags from a defined taxonomy (e.g., `breakfast`, `lunch`, `dinner`, `snack`, `vegetarian`, `vegan`, `gluten-free`, `quick`, `Italian`, `Asian`, etc.)
  - A maximum of 6 tags per recipe
  - Tags are stored as a string array in the recipe JSON
  - User can optionally pass `--tags` to override or augment auto-tags

---

**FR-5: Store Recipe in File-Based Database**

> As a user, I can have extracted recipes stored locally in a structured file database so that they persist and can be versioned with git.

- **Complexity:** S
- **Priority:** P0
- **Acceptance Criteria:**
  - Each recipe is stored as an individual JSON file under `data/recipes/<uuid>.json`
  - An index file `data/recipes/index.json` is maintained with `id`, `title`, `tags`, `createdAt`, `slug`
  - File writes are atomic (write to temp file, then rename)
  - Duplicate URL detection: if a recipe from the same URL already exists, the user is prompted to overwrite or skip
  - Recipe JSON schema is versioned (`"schemaVersion": 1`)

**Recipe JSON Schema:**
```json
{
  "schemaVersion": 1,
  "id": "<uuid>",
  "slug": "pasta-carbonara",
  "title": "Pasta Carbonara",
  "description": "Classic Roman pasta dish...",
  "sourceUrl": "https://...",
  "originalServings": 2,
  "servings": 4,
  "prepTime": "10 minutes",
  "cookTime": "20 minutes",
  "tags": ["Italian", "dinner", "quick"],
  "ingredients": [
    { "quantity": "400g", "item": "spaghetti" }
  ],
  "steps": [
    "Bring a large pot of salted water to a boil..."
  ],
  "createdAt": "2026-02-26T12:00:00Z"
}
```

---

**FR-6: Sync Recipe to Hostinger via FTP**

> As a user, I can have each newly added recipe automatically uploaded to my Hostinger account via FTP so that the viewer always has the latest data without a manual deploy step.

- **Complexity:** M
- **Priority:** P1
- **Acceptance Criteria:**
  - After a successful local write, the new recipe JSON file is uploaded via FTP to `/data/recipes/`
  - The `index.json` is also re-uploaded after each addition
  - FTP credentials are read from a local `.env` file (never committed to git)
  - Upload errors are reported clearly; local data is never rolled back on FTP failure
  - A `--no-ftp` flag skips the upload for offline use
  - Failed extractions are written to `logs/failures.log` with timestamp, URL, and error reason; a human-readable summary is printed to stderr

---

### Epic 2: Recipe Viewer (Hostinger — PHP/React)

---

**FR-7: Browse Recipe Collection**

> As a user, I can browse my full recipe collection on the hosted viewer so that I can find recipes on any device.

- **Complexity:** M
- **Priority:** P0
- **Acceptance Criteria:**
  - Index page lists all recipes with title, tags, and thumbnail (if available)
  - Recipes can be filtered by tag
  - Clicking a recipe navigates to its detail page
  - Responsive layout (works on mobile and desktop)

---

**FR-8: View Recipe Detail**

> As a user, I can view the full details of a recipe so that I can follow it while cooking.

- **Complexity:** S
- **Priority:** P0
- **Acceptance Criteria:**
  - Recipe page displays: title, description, prep/cook time, ingredient list, step-by-step instructions
  - Steps are numbered and clearly formatted
  - Tags are displayed as clickable chips

---

**FR-9: Rescale Recipe Servings**

> As a user, I can adjust the number of servings on the recipe viewer so that I can cook for more or fewer people without doing mental math.

- **Complexity:** M
- **Priority:** P0
- **Acceptance Criteria:**
  - A numeric input or +/- stepper on the recipe detail page controls serving count (default: 4)
  - All ingredient quantities update in real time as the serving count changes
  - Scaling handles fractional quantities gracefully (e.g., `0.67 cups` → `⅔ cup`)
  - Minimum serving count: 1; maximum: 20
  - The URL does not change when scaling (client-side only)

---

**FR-10: Deploy Viewer via FTP on PR Merge**

> As a developer, I can have the recipe viewer automatically deployed to Hostinger when a PR is merged to `main` so that updates are published without manual steps.

- **Complexity:** M
- **Priority:** P1
- **Acceptance Criteria:**
  - A GitHub Actions workflow triggers on push to `main`
  - The workflow builds the React front end (`npm run build`)
  - Built assets and PHP files are uploaded to Hostinger via FTP using stored GitHub Secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASS`)
  - The workflow fails and notifies on FTP error
  - Deploy does not affect `/data/recipes/` (recipe data is managed by the CLI, not the deploy pipeline)

---

## 6. Technical Decisions (Architect Notes)

| Decision | Choice | Rationale |
|---|---|---|
| CLI runtime | Node.js (TypeScript) | Native `fetch`, easy Claude SDK integration, cross-platform |
| AI integration | Anthropic Claude API (`claude-sonnet-4-6`) | Best-in-class instruction following for structured extraction |
| Local storage | Flat JSON files | No database dependency; git-versionable; trivially portable |
| FTP library (CLI) | `basic-ftp` (Node.js) | Lightweight, Promise-based, passive mode support |
| Viewer backend | PHP (no framework) | Hostinger shared hosting; no Node.js runtime available |
| Viewer frontend | React (Vite, no SSR) | Client-side only; PHP serves `index.html`, React handles routing |
| Viewer deployment | GitHub Actions + FTP | Simple, no containers or cloud CI needed |
| Config/secrets | `.env` (local) + GitHub Secrets (CI) | Keeps credentials out of source control |

---

## 7. Out of Scope (v1)

- Recipe search (full-text)
- Recipe editing via the viewer
- Image extraction / thumbnails
- Meal planning or shopping list generation
- OAuth / social login
- Multiple users or shared collections

---

## 8. Story Map & Prioritization

```
P0 (MVP — core loop works end-to-end)
  FR-1  Submit a Recipe URL
  FR-2  Extract Recipe via Claude AI
  FR-3  Normalize to 4 Servings
  FR-5  Store in File-Based DB
  FR-7  Browse Recipe Collection
  FR-8  View Recipe Detail
  FR-9  Rescale Servings

P1 (Complete product)
  FR-4  Auto-Tag Recipes
  FR-6  Sync to Hostinger via FTP
  FR-10 Deploy Viewer on PR Merge
```

---

## 9. Resolved Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Batch URL processing? | **No** — single URL per invocation for v1 |
| 2 | Viewer search vs. tag filtering? | **Tag filtering only** for v1 |
| 3 | Unit system? | **Metric** (g, ml, L, kg) — except `tsp`, `tbsp`, `pinch`, `dash` which stay as-is |
| 4 | Log failed extractions? | **Yes** — append to `logs/failures.log` with timestamp, URL, and reason |

---

*This document was produced by the product-manager agent and reviewed by the application-architect agent.*
