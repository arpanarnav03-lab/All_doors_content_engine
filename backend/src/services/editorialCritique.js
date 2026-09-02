const { callClaude } = require("./claude");

// Hardcoded rather than process.env.CLAUDE_MODEL: that env var is already
// the one model used everywhere else in this codebase (main draft
// generation, keyword extraction, SERP classification), so reusing it
// here would not actually be "cheaper" - it'd just be the same model as
// the call this is critiquing. A dedicated Haiku model keeps this cheap
// regardless of what CLAUDE_MODEL is set to.
const CRITIQUE_MODEL = "claude-haiku-4-5-20251001";

/**
 * Runs a cheap, focused editorial pass over an already-valid blog draft,
 * checking for four specific quality issues (cross-section repetition,
 * unhedged appreciation claims, generic conclusions, imprecise tables)
 * that structural validateBlog() doesn't catch. Never throws - returns []
 * on any failure so a critique-parsing problem never blocks the pipeline.
 */
async function critiqueEditorial(blog) {
  const critiquePrompt = `You are a strict editor reviewing this real estate blog draft.
Check specifically for these four issues and report ONLY genuine problems, one per line:

1. CROSS-SECTION REPETITION: does any headline figure (length, cost, station count, or
similar defining number) get fully restated with its full context in more than one
section, rather than being referenced briefly after its first full mention?

2. UNHEDGED APPRECIATION CLAIMS: does the draft state that prices or demand will likely
rise without qualifying what that depends on (e.g. supply, infrastructure, distance from
station, existing connectivity)?

3. GENERIC CONCLUSION: does the conclusion restate facts already given in the opening
paragraph, or end with a vague instruction like "watch progress closely" instead of a
specific, actionable next step the reader can take?

4. IMPRECISE TABLE VALUES: does any comparison table use "Approx." or similar vague
qualifiers across most of its cells without any precise figures, when more exact data
seems like it should reasonably be available from the content already in the draft?

Headline: ${blog.headline}
Body: ${blog.body}
Tables: ${JSON.stringify(blog.tables || [])}

Respond with ONLY a JSON array of issue strings describing genuine problems found, e.g.
["CROSS-SECTION REPETITION: the 44.65 km figure is restated in full in both the opening
and the comparison section"]. Return an empty array [] if none of these four issues are
genuinely present. Do not flag minor or borderline cases - only clear, genuine instances
of these four specific problems.`;

  const rawText = await callClaude({
    model: CRITIQUE_MODEL,
    maxTokens: 500,
    prompt: critiquePrompt,
  });

  try {
    const match = rawText.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (err) {
    console.error("Failed to parse editorial critique response:", err.message);
    return []; // fail gracefully - don't block the pipeline if critique parsing fails
  }
}

module.exports = { critiqueEditorial };
