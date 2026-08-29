# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A human-review layer inserted into an existing, fully-automated Apps Script content pipeline for Alldoors (a Bangalore real estate platform). It has three parts:

- **`backend/`** — Express + Turso (hosted libsql) API. Receives filtered/summarized news items from Apps Script, triages them into keyword-scored "Ideas" (with live Google Ads search volume and SerpAPI SERP/"People Also Ask" data), and — once a human picks one — generates a full blog draft via the Claude API for review. Deployed to Cloud Run.
- **`frontend/`** — React + Vite + Tailwind dashboard (Ideas → Queue → Review/Edit → Published) for triaging ideas and approving/rejecting drafts.
- **`apps-script/`** — patch files (not a standalone app) meant to be pasted into an *existing* separate Google Apps Script project that already does RSS fetching, filtering, and Google Docs/Sheets writes. See `SETUP.md` for the full connection sequence.

Nothing in this repo fetches RSS feeds, calls the Claude filter/summarize step, creates Google Docs, or writes to Google Sheets — all of that happens in the existing Apps Script project this repo patches. See **Architecture** below for exactly where the boundary is.

## Commands

Backend (`backend/`):
```bash
npm install
npm start          # node src/index.js, serves on PORT (default 8080)
npm run dev         # same, via nodemon (auto-restart)
```

Frontend (`frontend/`):
```bash
npm install
npm run dev          # Vite dev server on :5173, proxies /api/* to :8080 (see vite.config.js)
npm run build        # production build to frontend/dist
npm run preview      # preview the production build
```

No test suite or lint config exists in this repo currently.

There's no root-level orchestration — run backend and frontend as two separate processes in two terminals.

### One-time local-to-Turso data migration

`backend/scripts/migrateLocalDataToTurso.js` — standalone script, not imported anywhere, not run automatically. Copies every table from an old local `backend/drafts.db` (pre-Turso, better-sqlite3 era) into the live Turso database, table-by-table, using `INSERT OR IGNORE` keyed on each row's original id so it's safe to re-run. Only relevant if a local SQLite file from before the Turso migration still exists somewhere. Run via `node scripts/migrateLocalDataToTurso.js` from `backend/`.

### Local end-to-end testing

Apps Script runs on Google's servers and cannot reach `localhost`. To test the full pipeline locally, tunnel the backend with ngrok (`ngrok http 8080`), put the resulting HTTPS URL in the Apps Script project's `Config.gs` as `NODE_APP_URL`, and set `USE_REVIEW_APP: true` there. Full sequence in `SETUP.md`. In production this is unnecessary — `Config.gs`'s `NODE_APP_URL` points directly at the Cloud Run URL instead (see **Deployment** below).

### Deployment

Deployed to Cloud Run as service `alldoors-content-engine`, region `asia-south1`. Redeploy with:
```bash
cd backend && gcloud run deploy alldoors-content-engine \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars <comma-separated KEY=VALUE pairs, read fresh from backend/.env each time>
```
`backend/Dockerfile` + `backend/.dockerignore` (excludes `node_modules`, `.env`, local SQLite leftovers) drive the build. This is exactly why the app runs on Turso rather than a local SQLite file — Cloud Run containers don't persist a local filesystem across restarts/redeploys.

## Architecture

### The pipeline boundary

The existing Apps Script project (not in this repo) owns the entire front half of the pipeline: `fetchRSSFeeds()` → freshness/relevance filtering → title-similarity dedup → full-article scraping → a Claude call that extracts headline/summary/dataPoints/location/uniqueInsight/contentAngle per item. Only after all of that does `sendItemsToNodeApp()` (in `apps-script/WebApp.gs`) POST the processed items to this repo's backend at `POST /api/ideas`.

Once a human approves a draft in the dashboard, the backend POSTs it back to the Apps Script Web App (`APPS_SCRIPT_WEBAPP_URL`, handled by `doPost()` in `apps-script/WebApp.gs`), which does the actual Google Doc creation and Sheet row write — this repo cannot create Docs or write Sheets itself. `backend/src/services/appsScriptClient.js` is the only place that callback happens. `createBlogDoc()`/`appendTableToDoc()` (the Doc-rendering functions, including H2/H3 heading styling and `**bold**`-span parsing) exist **only** in the live Apps Script project, not anywhere in this repo — they're referenced by name in `apps-script/WebApp.gs` but never defined here.

### Two-stage backend pipeline: triage, then draft

Items from Apps Script don't get a full blog post immediately. `POST /api/ideas` only does lightweight **triage**: extract a primary keyword (`services/keywordExtraction.js`, a small Claude call), look up its Google Ads search volume (`services/keywordPlanner.js`), and pull SerpAPI's top-3 organic results (classified blog/service/other via Claude) plus up to 5 "People Also Ask" questions (`services/serpCheck.js`) — then store a lightweight row in the `ideas` table with `status: 'new'`. No blog is written at this point.

A human reviews Ideas in the dashboard and either dismisses one or clicks "Generate Draft" (`POST /api/ideas/:id/generate-draft`), which is the only place `runBlogGraph()` actually runs. The idea's stored `relatedQuestions` get threaded through as `buildBlogPrompt(item, targetWords, keywordData)`'s third argument, so the FAQ section can incorporate real Google-searched question phrasing rather than only Claude-invented ones.

### Backend request flow

- `backend/src/index.js` — Express app. `/api/ideas` mixes Apps-Script-only routes and dashboard-only routes, so the `x-service-key` check (`middleware/requireServiceKey.js`, checked against `NODE_APP_SECRET`) is applied per-route inside `routes/ideas.js`, not at the mount level. `/api/drafts` is entirely unprotected (same-origin dashboard calls only — there's no login system anywhere in this app). Awaits `db.js`'s `ready` promise before `app.listen()`, with a try/catch so a DB-init failure logs cleanly and exits instead of crashing raw. In production also serves `frontend/dist` as static files, so one process/one Cloud Run service serves both API and UI.
- `backend/src/routes/ideas.js` — `POST /` (service-key protected): triage intake, described above. `POST /pipeline-runs` (service-key protected): optional run-stats logging for the Activity view. `GET /` (dashboard): list ideas by status, default `new`. `POST /:id/generate-draft` (dashboard): runs `runBlogGraph()`, inserts into `drafts`, flips the idea to `drafted`; 409s if the idea isn't `status: 'new'` (double-click/double-consume protection). `POST /:id/dismiss` (dashboard): flips to `dismissed`, same 409 guard.
- `backend/src/blogGraph.js` — `runBlogGraph()` is a draft→validate→retry-once loop (not a real LangGraph graph yet, but intentionally shaped like one — see its docstring). A `JSON.parse` failure on Claude's response is caught per-attempt and triggers a retry rather than throwing uncaught; if every attempt fails to parse, `runBlogGraph` still returns a result object (`blog: null`) rather than throwing, and `routes/ideas.js` turns that into a clean `502` instead of inserting null data. `buildBlogPrompt(item, targetWords, keywordData)` holds the long-form prompt — numbered body-structure instructions (currently 1–8), H3 (`### `) sub-headings for sub-topics/Who-Benefits groups, SEO instructions (search intent, headline style, keyword placement, semantic keyword coverage), Indian English, FAQ de-duplication against the body, and a dedicated meta title requirement (55-60 chars, distinct from the H1 headline). The generated JSON shape is `{ headline, metaTitle, metaDescription, body, tables }`. When `keywordData.relatedQuestions` is present, real Google-searched "People Also Ask" questions are offered to the model for the FAQ section, but gated by a STRICT RELEVANCE TEST — a provided question is only used if it's specifically about this article's actual subject (the named project/developer/location/event), not just broadly related to the same keyword category; it's expected and correct for the model to use zero of them if none pass. `validateBlog()` checks for a body, headline, required `## Conclusion`/`## FAQs` sections, and absence of em/en dashes (it does not currently check for `metaTitle`).
- `backend/src/services/claude.js` — the single choke point for every Claude call. Two non-obvious things here: (1) it searches `response.content` for the `type: "text"` block rather than assuming `content[0]`, because Claude models return an interleaved `thinking` block first when extended thinking is active — indexing blindly silently returns `undefined` and breaks JSON parsing downstream; (2) it explicitly sets `thinking: { type: "adaptive" }` + `output_config: { effort: "medium" }` — without this, extended thinking can consume the *entire* `max_tokens` budget on long/complex prompts (observed directly: a 6000-token budget fully consumed by thinking, zero text back), while `effort: "medium"` reliably leaves room for output on long prompts and costs ~0 thinking tokens on trivial calls (classification, keyword extraction).
- `backend/src/services/keywordExtraction.js` — one small Claude call (`extractPrimaryKeyword`) per item, JSON-only response. Returns `null` on any failure; the caller skips the item entirely rather than creating a keyword-less row.
- `backend/src/services/keywordPlanner.js` — Google Ads Keyword Planner integration (`google-ads-api` package). Gracefully degrades to `null` everywhere if any of the 5 `GOOGLE_ADS_*` env vars are missing (warns once at module load, not per-call). 14-day cache in the `live_keyword_volume` table. Note: `avg_monthly_searches` bucketing detection (`is_bucketed`) is a heuristic (checks against known low-spend-account bucket values) since the Google Ads API doesn't expose an explicit "this is bucketed" flag on this endpoint.
- `backend/src/services/serpCheck.js` — SerpAPI integration. `fetchTopResults()` extracts both `organic_results` (top 3, classified blog/service/other via a small Claude call) and `related_questions` (up to 5 "People Also Ask" entries — reliably has `question`, but `snippet`/`link` aren't always present depending on which PAA variant Google returns) from one API call. `checkKeywordSerp()` returns `{ topResults, relatedQuestions }`, cached 14 days in `serp_cache`. `normalizeSerpResults()` (exported) handles backward compatibility with cache/idea rows written before PAA support existed, which stored a plain array instead of this object shape.
- `backend/src/routes/drafts.js` — CRUD-ish surface for the dashboard: list/get by status, `PATCH` to save inline edits (`headline`, `metaTitle`, `metaDescription`, `body`, each independently optional via `field ?? current.field`), `POST /:id/approve` (triggers the Apps Script callback above), `POST /:id/reject`.
- `backend/src/utils/asyncHandler.js` — wraps every async Express route handler so a rejected promise forwards to `next(err)` instead of becoming an unhandled rejection. Express 4 doesn't await async handlers itself, so without this, any awaited call that rejects (a transient DB/network error, anything) crashes the *entire process*, not just that request. Paired with a catch-all error middleware in `index.js` (must stay last in the middleware chain, 4-arg signature) that logs and returns a clean `500` instead.
- `backend/src/db.js` — `@libsql/client` (hosted Turso, not a local file — required for Cloud Run, whose filesystem doesn't persist across restarts). Sets `dns.setDefaultResultOrder("ipv4first")` before creating the client: on networks with NAT64/DNS64, Node's `fetch` can otherwise hang on a synthesized dead IPv6 address until it burns the whole connect timeout, before ever trying the real IPv4 one. Exports `{ db, ready }` — `ready` is the async table-creation promise, started once at module load; only `index.js` needs to await it (by the time any HTTP request reaches a route handler, it's already resolved). Five tables: `drafts`, `pipeline_runs`, `ideas` (triage rows; `serp_results_json` added via a try/catch `ALTER TABLE`, since libsql has no `ADD COLUMN IF NOT EXISTS`), `serp_cache`, `live_keyword_volume`. No migration framework — schema changes are additive `CREATE TABLE IF NOT EXISTS` / guarded `ALTER TABLE` statements run on every boot.

### Frontend

Four routes (`frontend/src/App.jsx`): `/` (Ideas — the landing page), `/queue` (Queue), `/review/:id` (Review/Edit), `/published`. `frontend/src/api.js` is the sole fetch wrapper — all requests go through `/api/...`, proxied to the backend in dev by `vite.config.js`. `Ideas.jsx` renders each idea's keyword/volume line, a "Top search results" block (blog/service/other badges), and a "People Also Ask" block, with "Generate Draft" / "Dismiss" actions. `Review.jsx` edits `headline`, `metaTitle` (with a live character counter that turns amber past 60 chars), `metaDescription`, and `body` as independent state, all sent together on both "Save Draft" and "Approve & Send" (approve saves first, then calls the approve endpoint separately with no field payload).

### Config

Backend env vars (`backend/.env`; `backend/.env.example` is missing a couple of these — treat the list below as authoritative): `CLAUDE_API_KEY`, `CLAUDE_MODEL` (⚠ the live `.env` currently has `CLAUDE_MODEL_BLOG` instead — `blogGraph.js`/`claude.js` read `CLAUDE_MODEL`, so that var is silently unset locally and must be passed explicitly on every Cloud Run deploy), `CLAUDE_MAX_TOKENS_BLOG`, `BLOG_TARGET_WORDS`, `NODE_APP_SECRET` (Apps Script → Node auth), `APPS_SCRIPT_WEBAPP_URL` + `APPS_SCRIPT_SHARED_SECRET` (Node → Apps Script auth, the reverse direction), `SERPAPI_KEY` (also missing from `.env.example`), `GOOGLE_ADS_DEVELOPER_TOKEN`/`GOOGLE_ADS_CLIENT_ID`/`GOOGLE_ADS_CLIENT_SECRET`/`GOOGLE_ADS_REFRESH_TOKEN`/`GOOGLE_ADS_CUSTOMER_ID`, `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, `PORT`.

The Apps Script side has its own separate `Config.gs` with its own Claude key/model settings for the filter/summarize step — that's a distinct integration from this backend's, not shared config.
