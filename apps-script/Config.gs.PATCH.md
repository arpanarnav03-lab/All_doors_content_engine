# Patch for Config.gs

Add this block right after your existing `CLAUDE_CALL_DELAY_MS: 1000,` line
and before the `// ---- TESTING TOGGLES ----` section. Nothing else in
Config.gs needs to change.

```javascript
  // ---- REVIEW APP INTEGRATION ----
  // false = old behavior: Apps Script generates blogs directly (current system)
  // true  = new behavior: send filtered items to Node app for review before drafting
  USE_REVIEW_APP: false,

  // The deployed Node app's base URL (no trailing slash), e.g.
  // "https://alldoors-review-app-xxxxx-el.a.run.app" once deployed,
  // or your ngrok URL (e.g. "https://abcd1234.ngrok-free.app") while testing locally.
  NODE_APP_URL: "",

  // Must match NODE_APP_SECRET in the Node app's .env — this is what
  // Node checks on incoming POST /api/ideas requests.
  NODE_APP_SECRET: "",

  // Must match APPS_SCRIPT_SHARED_SECRET in the Node app's .env — this is
  // what doPost() in WebApp.gs checks on incoming requests from Node.
  APPS_SCRIPT_SHARED_SECRET: "",
```

Leave `USE_REVIEW_APP: false` and the URL/secret fields blank until you've
deployed the Node app and are ready to test the new flow (see the main
SETUP.md in this package for the full connection sequence).
