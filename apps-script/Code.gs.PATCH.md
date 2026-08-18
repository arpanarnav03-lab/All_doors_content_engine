# Patch for Code.gs

Replace your existing `runDailyPipeline()` function with this version.
Everything else in Code.gs stays exactly as it is — `generateBlogDrafts`,
`createBlogDoc`, `writeToSheet`, `sendDailyDigestEmail`, etc. are all
still used, just conditionally.

```javascript
function runDailyPipeline() {
  const rawItems = fetchRSSFeeds();
  const existingTitles = getExistingTitlesFromSheet();
  const processedItems = processWithClaude(rawItems, existingTitles);

  if (processedItems.length === 0) return;

  if (CONFIG.USE_REVIEW_APP) {
    // New path: send to Node review app, human approves before Doc/Sheet writes happen
    sendItemsToNodeApp(processedItems);
  } else {
    // Old path: unchanged, fully automated (current behavior)
    generateBlogDrafts(processedItems);
    writeToSheet(processedItems);
    sendDailyDigestEmail(processedItems);
  }
}
```

`sendItemsToNodeApp()` itself lives in the new `WebApp.gs` file (see that
file in this folder) — add that as a brand new file in your Apps Script
project, don't paste it into Code.gs.
