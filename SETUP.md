# Alldoors Content Review App — Setup Guide

This package contains:
- `backend/` — Express + SQLite API, generates blog drafts via Claude, holds them for review
- `frontend/` — React + Tailwind dashboard (Queue, Review/Edit, Published)
- `apps-script/` — files/patches to add to your EXISTING Apps Script project

Nothing in your current Apps Script project is deleted or broken by this.
You're adding one new file (`WebApp.gs`) and patching two existing ones
(`Code.gs`, `Config.gs`) behind a feature flag that defaults to OFF.

---

## 1. Install and run the backend locally

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:
- `CLAUDE_API_KEY` — your Anthropic key (same one from Config.gs, or a dedicated new one)
- `NODE_APP_SECRET` — make up a long random string, e.g. run `openssl rand -hex 24`
- `APPS_SCRIPT_SHARED_SECRET` — make up another long random string (can differ from the one above)
- Leave `APPS_SCRIPT_WEBAPP_URL` blank for now — you'll fill it in after Step 3

Start the backend:
```bash
npm start
```
Confirm it's alive: `curl http://localhost:8080/health` should return `{"ok":true}`.

## 2. Install and run the frontend locally

In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 — you'll see the dashboard (empty Queue, since
no drafts exist yet). The Vite dev server proxies `/api` calls to the
backend on port 8080 automatically (see `vite.config.js`).

## 3. Add the Web App endpoint to your EXISTING Apps Script project

1. Open your Apps Script project (the same one with `Code.gs` and `Config.gs`)
2. Add a new file: **File → New → Script** → name it `WebApp.gs`
3. Copy the entire contents of `apps-script/WebApp.gs` from this package into it
4. Open `Config.gs` and apply the patch described in `apps-script/Config.gs.PATCH.md`
   (adds `USE_REVIEW_APP`, `NODE_APP_URL`, `NODE_APP_SECRET`, `APPS_SCRIPT_SHARED_SECRET`)
5. Open `Code.gs` and apply the patch described in `apps-script/Code.gs.PATCH.md`
   (replaces `runDailyPipeline()` with the flag-aware version)
6. Fill in `Config.gs`'s new fields:
   - `NODE_APP_SECRET` — must exactly match your backend `.env`'s `NODE_APP_SECRET`
   - `APPS_SCRIPT_SHARED_SECRET` — must exactly match your backend `.env`'s `APPS_SCRIPT_SHARED_SECRET`
   - Leave `NODE_APP_URL` and `USE_REVIEW_APP` for the next step
7. **Deploy the Web App:** Deploy → New deployment → select type "Web app"
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
   - Click Deploy, authorize the requested scopes if prompted
   - Copy the resulting URL (ends in `/exec`)
8. Paste that URL into your backend's `.env` as `APPS_SCRIPT_WEBAPP_URL`, then restart the backend (`npm start` again)

## 4. Connect Apps Script to your local Node app (for testing)

Since Apps Script runs on Google's servers, it can't reach `localhost` on
your Mac directly. Use ngrok to expose your local backend temporarily:

```bash
# in a third terminal
ngrok http 8080
```

Copy the `https://xxxx.ngrok-free.app` URL it gives you, paste it into
`Config.gs`'s `NODE_APP_URL` field (no trailing slash), and set:
```javascript
USE_REVIEW_APP: true,
```

## 5. Test the full loop

1. In the Apps Script editor, manually run `runDailyPipeline()`
2. Check the Execution log — you should see `"Sent N items to Node app"`
3. Refresh your local dashboard (http://localhost:5173) — new drafts should appear in the Queue
4. Click into one, review/edit it, click **Approve & Send**
5. Confirm: a real Google Doc gets created, and a new row appears in your `ContentIdeas` Sheet
6. Check the **Published** tab in the dashboard — the approved item should show up there with a working "Open Doc" link

If any step fails, check both logs: the Apps Script Execution log, and
your backend terminal's console output (errors are logged there).

## 6. Roll back safely at any time

Set `USE_REVIEW_APP: false` in `Config.gs` — the pipeline instantly
reverts to fully-automated generation exactly as it worked before this
package was added. No data is lost either way; both paths write to the
same `ContentIdeas` Sheet.

## 7. Deploying for real (once local testing works)

Replace the ngrok URL with a real deployed backend:

```bash
cd backend
gcloud run deploy alldoors-review-app \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars CLAUDE_API_KEY=...,NODE_APP_SECRET=...,APPS_SCRIPT_WEBAPP_URL=...,APPS_SCRIPT_SHARED_SECRET=...
```

Before deploying, run `npm run build` inside `frontend/` — the backend's
`src/index.js` is already set up to serve the built frontend from
`frontend/dist` in production, so one Cloud Run service serves both the
API and the dashboard UI at the same URL.

Update `Config.gs`'s `NODE_APP_URL` to the real Cloud Run URL (replacing
ngrok), and you're fully live — the 7am/4pm triggers will now feed your
review dashboard automatically instead of ngrok's temporary tunnel.
