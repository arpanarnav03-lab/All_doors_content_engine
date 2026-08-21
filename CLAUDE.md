# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A human-review layer inserted into an existing, fully-automated Apps Script content pipeline for Alldoors (a Bangalore real estate platform). It has three parts:

- **`backend/`** — Express + SQLite API. Receives filtered/summarized news items from Apps Script, generates full blog drafts via the Claude API, and holds them for human review.
- **`frontend/`** — React + Vite + Tailwind dashboard (Queue → Review/Edit → Published) for approving or rejecting drafts.
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

### Local end-to-end testing

Apps Script runs on Google's servers and cannot reach `localhost`. To test the full pipeline locally, tunnel the backend with ngrok (`ngrok http 8080`), put the resulting HTTPS URL in the Apps Script project's `Config.gs` as `NODE_APP_URL`, and set `USE_REVIEW_APP: true` there. Full sequence in `SETUP.md`.

## Architecture

### The pipeline boundary

The existing Apps Script project (not in this repo) owns the entire front half of the pipeline: `fetchRSSFeeds()` → freshness/relevance filtering → title-similarity dedup → full-article scraping → a Claude call that extracts headline/summary/dataPoints/location/uniqueInsight/contentAngle per item. Only after all of that does `sendItemsToNodeApp()` (in `apps-script/WebApp.gs`) POST the processed items to this repo's backend at `POST /api/ideas`.

This backend's only generation responsibility is turning each pre-processed item into a full long-form blog post (`backend/src/blogGraph.js`). It does not fetch, filter, or dedupe anything itself.

Once a human approves a draft in the dashboard, the backend POSTs it back to the Apps Script Web App (`APPS_SCRIPT_WEBAPP_URL`, handled by `doPost()` in `apps-script/WebApp.gs`), which does the actual Google Doc creation and Sheet row write — this repo cannot create Docs or write Sheets itself. `backend/src/services/appsScriptClient.js` is the only place that callback happens.

### Backend request flow

- `backend/src/index.js` — Express app. Mounts `/api/ideas` (protected by an `x-service-key` header checked against `NODE_APP_SECRET`, since only Apps Script should call it) and `/api/drafts` (unprotected, called by the same-origin dashboard). In production it also serves `frontend/dist` as static files, so one process serves both API and UI.
- `backend/src/routes/ideas.js` — `POST /` receives `{ items: [...] }` from Apps Script, runs each item through `runBlogGraph()`, and inserts a row per item into the `drafts` SQLite table regardless of whether generation succeeded (failures are still recorded with the error, not silently dropped). Also has `POST /pipeline-runs`, an optional endpoint Apps Script can hit to log run stats for the Activity view.
- `backend/src/blogGraph.js` — `runBlogGraph()` is a draft→validate→retry-once loop (not a real LangGraph graph yet, but intentionally shaped like one — see its docstring). `buildBlogPrompt()` holds the actual long-form prompt; `validateBlog()` checks for a body, headline, required `## Conclusion`/`## FAQs` sections, and absence of em/en dashes.
- `backend/src/services/claude.js` — the single choke point for every Claude call. Note: it searches `response.content` for the `type: "text"` block rather than assuming `content[0]`, because Claude models return an interleaved `thinking` block first when extended thinking is active — indexing blindly silently returns `undefined` and breaks JSON parsing downstream.
- `backend/src/routes/drafts.js` — CRUD-ish surface for the dashboard: list/get by status, `PATCH` to save inline edits, `POST /:id/approve` (triggers the Apps Script callback above), `POST /:id/reject`.
- `backend/src/db.js` — better-sqlite3, WAL mode, two tables: `drafts` (`item_json`/`original_blog_json`/`final_blog_json` stored as JSON text blobs, plus `status`: pending/approved/rejected) and `pipeline_runs`. Schema is created inline via `CREATE TABLE IF NOT EXISTS` on require, no migration system.

### Frontend

Three routes (`frontend/src/App.jsx`): `/` (Queue), `/review/:id` (Review/Edit), `/published`. `frontend/src/api.js` is the sole fetch wrapper — all requests go through `/api/...`, proxied to the backend in dev by `vite.config.js`.

### Config

Backend env vars (`backend/.env`, see `backend/.env.example`): `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS_BLOG`, `BLOG_TARGET_WORDS`, `NODE_APP_SECRET` (Apps Script → Node auth), `APPS_SCRIPT_WEBAPP_URL` + `APPS_SCRIPT_SHARED_SECRET` (Node → Apps Script auth, the reverse direction), `PORT`.

The Apps Script side has its own separate `Config.gs` with its own Claude key/model settings for the filter/summarize step — that's a distinct integration from this backend's, not shared config.
