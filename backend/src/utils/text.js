/**
 * Pulls the first {...} JSON object out of a Claude response, even if the
 * model wrapped it in markdown fences or added stray text around it.
 */
function extractJsonBlock(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return match[0];

  // Greedy match found nothing (no {...} pair at all) - try a non-greedy
  // match as a fallback before giving up, in case stray text around a
  // single brace pair is confusing the greedy pattern.
  const lazyMatch = cleaned.match(/\{[\s\S]*?\}/);
  return lazyMatch ? lazyMatch[0] : cleaned;
}

/**
 * Recursively strips em dashes (—) and en dashes (–) from every string in
 * a parsed Claude JSON response, replacing them with a comma.
 * FIXED VERSION: only collapses repeated spaces/tabs, never newlines, so
 * paragraph breaks (and therefore "## Heading" splitting downstream) are
 * preserved. This was the bug that flattened Conclusion/FAQs headings in
 * the original Apps Script version.
 */
function stripEmDashesDeep(value) {
  if (typeof value === "string") {
    return value
      .replace(/[—–]/g, ",")
      .replace(/,\s*,/g, ",")
      .replace(/[ \t]{2,}/g, " ") // only spaces/tabs, keep \n intact
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(stripEmDashesDeep);
  }
  if (value && typeof value === "object") {
    const cleaned = {};
    Object.keys(value).forEach((key) => {
      cleaned[key] = stripEmDashesDeep(value[key]);
    });
    return cleaned;
  }
  return value;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = { extractJsonBlock, stripEmDashesDeep, escapeHtml };
