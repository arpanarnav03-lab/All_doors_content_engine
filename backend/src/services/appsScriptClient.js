/**
 * Sends an approved draft to the Apps Script Web App, which creates the
 * actual Google Doc and writes the Sheet row (Apps Script keeps that
 * logic - see WebApp.gs on the Apps Script side).
 */
async function sendToAppsScript(payload) {
  const url = process.env.APPS_SCRIPT_WEBAPP_URL;
  if (!url) {
    throw new Error("APPS_SCRIPT_WEBAPP_URL is not set in .env");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      secret: process.env.APPS_SCRIPT_SHARED_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script call failed (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { sendToAppsScript };
