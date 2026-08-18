/**
 * WEB APP ENDPOINT — receives approved drafts back from the Node review app.
 *
 * Deploy: Apps Script editor -> Deploy -> New deployment -> Web app
 *   Execute as: Me
 *   Who has access: Anyone with the link
 * Copy the resulting /exec URL into the Node app's .env as APPS_SCRIPT_WEBAPP_URL.
 *
 * This file does NOT touch your existing Code.gs functions — createBlogDoc()
 * and writeToSheet() are reused exactly as they already exist.
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" });
  }

  // Shared-secret check — must match APPS_SCRIPT_SHARED_SECRET in the Node app's .env
  if (payload.secret !== CONFIG.APPS_SCRIPT_SHARED_SECRET) {
    return jsonResponse({ ok: false, error: "Unauthorized" });
  }

  if (payload.action === "createDraft") {
    try {
      const item = payload.item;
      const blog = payload.blog;

      const blogDocUrl = createBlogDoc(item, blog);

      writeToSheet([Object.assign({}, item, { BlogDocUrl: blogDocUrl })]);

      return jsonResponse({ ok: true, blogDocUrl: blogDocUrl });
    } catch (err) {
      Logger.log("doPost createDraft failed: " + err);
      return jsonResponse({ ok: false, error: String(err) });
    }
  }

  return jsonResponse({ ok: false, error: "Unknown action: " + payload.action });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Sends filtered/summarized items to the Node review app instead of
 * generating blogs directly. Called from runDailyPipeline() when
 * CONFIG.USE_REVIEW_APP is true.
 */
function sendItemsToNodeApp(processedItems) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-service-key": CONFIG.NODE_APP_SECRET },
    payload: JSON.stringify({ items: processedItems }),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(CONFIG.NODE_APP_URL + "/api/ideas", options);
  Logger.log("Sent " + processedItems.length + " items to Node app: " + response.getContentText());
}
