const { callClaude } = require("../../services/claude");
const { extractJsonBlock, stripEmDashesDeep } = require("../../utils/text");
const { buildBlogPrompt } = require("../../blogGraph");

async function draftNode(state) {
  const prompt = buildBlogPrompt(state.item, state.targetWords, state.keywordData);
  const rawText = await callClaude({
    model: process.env.CLAUDE_MODEL,
    maxTokens: Number(process.env.CLAUDE_MAX_TOKENS_BLOG) || 3000,
    prompt,
  });

  try {
    const parsed = stripEmDashesDeep(JSON.parse(extractJsonBlock(rawText)));
    return { draft: parsed, parseError: null, attempt: state.attempt + 1 };
  } catch (parseErr) {
    console.error(`JSON parse failed on attempt ${state.attempt} for "${state.item.Headline}": ${parseErr.message}`);
    return { draft: null, parseError: parseErr.message, attempt: state.attempt + 1 };
  }
}

module.exports = { draftNode };
