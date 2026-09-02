async function applyTargetedFix(blog, issues) {
  const { callClaude } = require("./claude");
  const { extractJsonBlock, stripEmDashesDeep } = require("../utils/text");

  const fixPrompt = `Here is a blog draft in JSON format:

${JSON.stringify(blog)}

The draft has the following specific issues. Fix ONLY these issues, changing as little
else as possible in the rest of the draft - do not rewrite sections that aren't related
to these issues:

${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

Return the corrected draft as JSON in the exact same shape as the input (same fields:
headline, metaTitle, urlSlug, metaDescription, body, targetKeyword, tables). Respond with
ONLY the JSON, no other text, no markdown code fences.`;

  const rawText = await callClaude({
    model: process.env.CLAUDE_MODEL_BLOG,
    maxTokens: 2500,
    prompt: fixPrompt,
  });

  try {
    return stripEmDashesDeep(JSON.parse(extractJsonBlock(rawText)));
  } catch (err) {
    console.error("Targeted fix failed to parse response:", err.message);
    return null; // signal failure, caller should fall back to the original draft
  }
}

module.exports = { applyTargetedFix };
