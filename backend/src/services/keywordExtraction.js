const { callClaude } = require("./claude");
const { extractJsonBlock } = require("../utils/text");

function buildKeywordPrompt(item) {
  return (
    "Given this real estate news item, identify the single primary SEO keyword or short " +
    "keyword phrase (2-5 words) a Bangalore homebuyer or investor would search on Google to " +
    "find content about this topic. Prefer a concise, high-intent phrase over a long " +
    "descriptive one.\n\n" +
    "Headline: " + item.Headline + "\n" +
    "Summary: " + item.Summary + "\n" +
    "Location: " + item.Location + "\n\n" +
    "Respond ONLY with JSON, no other text, no markdown code fences:\n" +
    '{"keyword": "..."}'
  );
}

/**
 * Extracts a single primary SEO keyword for an item via Claude. Never
 * throws - returns null on any failure so the caller can skip the item
 * rather than crash the whole intake batch.
 */
async function extractPrimaryKeyword(item) {
  try {
    const rawText = await callClaude({
      model: process.env.CLAUDE_MODEL,
      maxTokens: Number(process.env.CLAUDE_MAX_TOKENS_KEYWORD) || 100,
      prompt: buildKeywordPrompt(item),
    });
    const parsed = JSON.parse(extractJsonBlock(rawText));
    const keyword = (parsed.keyword || "").trim();
    return keyword || null;
  } catch (err) {
    console.error("Keyword extraction failed for item:", item.Title, err.message || err);
    return null;
  }
}

module.exports = { extractPrimaryKeyword, buildKeywordPrompt };
