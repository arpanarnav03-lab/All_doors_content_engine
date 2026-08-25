const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

/**
 * Single choke point for every Claude call in this app. Everything
 * downstream (blogGraph.js, any future filter/summarize logic) calls
 * this function and nothing else. That's deliberate: when you're ready
 * to move to LangChain's ChatAnthropic (or add LangGraph nodes), you
 * only ever need to change what's inside this one function.
 */
async function callClaude({ model, maxTokens, prompt }) {
  const response = await client.messages.create({
    model: model || process.env.CLAUDE_MODEL || "claude-sonnet-5",
    max_tokens: maxTokens || 3000,
    // Without this, extended thinking runs unbounded and can consume the
    // entire max_tokens budget on long/complex prompts, leaving nothing
    // for the actual text response (observed directly: a 6000-token
    // budget fully consumed by thinking, zero text back). "adaptive" +
    // "medium" scales thinking to task complexity - verified it stays at
    // 0 thinking tokens for trivial classification calls and a bounded,
    // small amount for full blog-length prompts, reliably leaving room
    // for output either way.
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content && response.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude API returned no text content");
  }

  return textBlock.text;
}

module.exports = { callClaude };
