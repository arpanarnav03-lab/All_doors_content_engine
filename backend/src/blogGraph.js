const { callClaude } = require("./services/claude");
const { extractJsonBlock, stripEmDashesDeep } = require("./utils/text");

/**
 * Builds the exact prompt used by Apps Script's generateBlogPost(), so
 * output shape/quality stays consistent with what you had before.
 */
function buildBlogPrompt(item, targetWords) {
  const groundingText =
    item.ArticleText && item.ArticleText.length > 200
      ? item.ArticleText
      : item.Summary;

  return (
    "You are a content writer for Alldoors, a Bangalore real estate platform. Write an " +
    "authoritative, SEO-optimized, definition-first blog post modeled on how comprehensive " +
    "industry explainer articles are structured (the kind that rank for 'what is X' and " +
    "'how does X work' searches), based on the research below.\n\n" +
    "News headline: " + item.Headline + "\n" +
    "Summary: " + item.Summary + "\n" +
    "Data points to work in where relevant: " + item.DataPoints + "\n" +
    "Locality: " + item.Location + "\n" +
    "Unique insight to build the article around: " + item.UniqueInsight + "\n" +
    "Suggested content angle: " + item.ContentAngle + "\n" +
    "Source article text (for grounding, do not copy sentences from it): " + groundingText + "\n" +
    "Source URL: " + item.Source + "\n\n" +
    "Identify the primary topic/concept this article is really about (e.g. a policy, a " +
    "project type, a market mechanism, a regulation) - this becomes your target keyword, " +
    "repeated naturally throughout headers and body text the way authoritative reference " +
    "content does, without keyword-stuffing.\n\n" +
    "Structure the body EXACTLY as follows, in this order:\n\n" +
    "1. OPENING DEFINITION (no subheading, goes directly under the title): 2-4 sentences " +
    "that directly and authoritatively answer 'what is [topic]' or 'what happened' as if " +
    "opening a reference entry. No throat-clearing, no 'in this article we will discuss'. " +
    "State the core fact/definition immediately, then why it matters to a Bangalore " +
    "homebuyer, renter, or investor.\n\n" +
    "2. \"## What Is [Topic]?\" or equivalent definitional heading - expand the opening " +
    "definition into a full paragraph, explaining the concept clearly for someone " +
    "encountering it for the first time.\n\n" +
    "3. \"## Why [Topic] Matters\" or equivalent - open with one framing sentence, then a " +
    "short bolded lead-in line like 'Key reasons this matters:' followed by 4-6 bullet " +
    "points, each a short punchy phrase (not full sentences). Close with one sentence " +
    "tying the bullets back to the main keyword/topic.\n\n" +
    "4. \"## How [Topic] Works\" or \"## What This Means For [Locality/Buyers]\" - open with " +
    "a framing paragraph, then break into 3-5 sub-topics. For EACH sub-topic, write a " +
    "short bolded lead phrase (2-5 words, like a mini-heading) as the FIRST few words of " +
    "its paragraph, followed immediately by 2-4 sentences of explanation. Do not use a " +
    "real heading for these, just start the paragraph with the bolded phrase inline.\n\n" +
    "5. WITHIN one of the sections above, include a genuine INFERENCE not stated in the " +
    "source article - a reasonable conclusion a knowledgeable local real estate observer " +
    "would draw, based on real signals in the source text (numbers, timing, precedent, " +
    "comparable areas). Signal this is analysis, not a reported fact, with phrasing like " +
    "'what this likely means, though it's not explicitly stated, is...' or 'reading " +
    "between the lines here...'. If nothing is genuinely inferable, fall back to the " +
    "unique insight provided above instead of inventing a stretch.\n\n" +
    "6. \"## [Topic] vs [Comparable Alternative]\" (only include this section if a " +
    "genuine comparison exists - e.g. this locality vs a comparable one, buying now vs " +
    "waiting, this project type vs another). Open with a framing paragraph on why the " +
    "comparison matters, then include a comparison TABLE (see TABLES instructions " +
    "below), then a closing paragraph interpreting what the comparison means for the " +
    "reader. Skip this entire section if no genuine comparison exists in the source " +
    "material - do not force one.\n\n" +
    "7. \"## What This Means for Alldoors Buyers\" or similarly branded section - 2-3 " +
    "sub-topics (same bolded-lead-phrase-inline style as section 4) connecting the topic " +
    "to practical next steps a reader should take (questions to ask a developer, things " +
    "to verify, timing considerations). Keep this genuinely useful, not a sales pitch.\n\n" +
    "8. \"## Conclusion\" - 2-3 short paragraphs (not one dense block): first restates the " +
    "core fact/definition and why it matters, second connects it to the bigger picture " +
    "(the locality's or Bangalore's broader trajectory), third gives a clear, direct " +
    "closing takeaway sentence.\n\n" +
    "9. \"## FAQs\" - 6-8 question-and-answer pairs a Bangalore homebuyer/investor " +
    "searching about this topic would realistically ask, ordered from most basic " +
    "('What is [topic]?') to more specific/practical. Format each pair as the question " +
    "on its own line immediately followed by a 2-4 sentence answer (denser and more " +
    "complete than a one-liner - each answer should be able to stand alone as a full " +
    "explanation), with a blank line between separate Q&A pairs. Base these on the " +
    "actual content, not generic filler.\n\n" +
    "TABLES: include one if section 6 (comparison) is used, or if the data points " +
    "genuinely contain comparable rows/columns worth tabulating (prices across " +
    "localities, before/after figures, a timeline, stage-by-stage breakdowns). Do NOT " +
    "invent a table if the material doesn't support it. If included:\n" +
    "  - Add it to a top-level \"tables\" array in your JSON response.\n" +
    "  - Keep it small: 2-5 columns, 2-6 rows.\n" +
    "  - Mark exactly where it belongs by inserting a line containing ONLY " +
    "\"[TABLE:1]\" as its own paragraph, separated by blank lines, at the point in the " +
    "body where the table should appear.\n" +
    "  - Each table object: {\"caption\": \"short one-line caption\", \"headers\": " +
    "[\"...\", \"...\"], \"rows\": [[\"...\", \"...\"], [\"...\", \"...\"]]}.\n\n" +
    "Additional requirements:\n" +
    "- EXPLAIN UNCOMMON TERMS ON FIRST USE, BRIEFLY: any acronym, industry jargon, or " +
    "specialized concept a general homebuyer/investor wouldn't already know must be " +
    "expanded the FIRST time it appears, not later in the article. This includes " +
    "acronyms (spell out in full, e.g. 'facility management (FM) companies' not just " +
    "'FM companies'), regulatory/legal terms, real estate jargon (Grade-A/Grade-B, " +
    "absorption, micro-market), and any organization type or mechanism a layperson " +
    "wouldn't recognize by name alone.\n" +
    "  KEEP THE EXPLANATION SHORT: a 3-8 word clause folded into the same sentence, " +
    "never a separate sentence, parenthetical dump, or standalone definition. Example: " +
    "instead of 'A facility management company recently leased space. Facility " +
    "management companies handle building operations, security, and maintenance for " +
    "large properties.' write 'A facility management company, which handles building " +
    "operations and maintenance for large properties, recently leased space.' One " +
    "clause, then move on immediately - do not linger on the definition or add a " +
    "second sentence about it.\n" +
    "  After the first explained use, use the short form/acronym freely for the rest " +
    "of the article without re-explaining it.\n" +
    "- Roughly " + targetWords + " words total, including opening definition and FAQs.\n" +
    "- Tone: authoritative and reference-like in definitional sections, conversational " +
    "and direct ('you') in the buyer-facing sections - not stiff throughout, but not " +
    "casual either. Avoid hedging phrases like 'it is important to note that'.\n" +
    "- Repeat the core topic/keyword naturally across headers and body text the way " +
    "reference content does for SEO, without sounding robotic or repetitive to a human " +
    "reader.\n" +
    "- Follow the suggested content angle above rather than just rewriting the news " +
    "summary.\n" +
    "- Do not include the headline inside the body - it goes in a separate field.\n" +
    "- Write original analysis - do not copy sentences from the summary or source text " +
    "verbatim.\n" +
    "- Never use em dashes (—) or en dashes (–) anywhere in the headline, meta " +
    "description, or body - use commas, periods, or parentheses instead. This applies " +
    "to every sentence, not just some.\n\n" +
    "Respond ONLY with JSON in this exact shape, no other text, no markdown code fences. " +
    "Omit \"tables\" entirely (or use an empty array) if no table is warranted:\n" +
    '{"headline": "...", "metaDescription": "one sentence, under 25 words", "body": "...", ' +
    '"tables": [{"caption": "...", "headers": ["..."], "rows": [["..."]]}]}'
  );
}

/**
 * Validates a generated blog draft has the required structure. This is
 * the check a future LangGraph "validate" node would run before deciding
 * whether to accept the draft or loop back to "draft" for a retry.
 */
function validateBlog(blog) {
  const issues = [];
  if (!blog || !blog.body) {
    issues.push("Missing body");
    return { valid: false, issues };
  }
  if (!blog.headline) issues.push("Missing headline");
  if (!blog.body.includes("## Conclusion")) issues.push("Missing ## Conclusion section");
  if (!blog.body.includes("## FAQs")) issues.push("Missing ## FAQs section");
  if (/[—–]/.test(blog.body) || /[—–]/.test(blog.headline || "")) {
    issues.push("Contains em dash or en dash");
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Generates a full blog draft for one processed item. Currently a plain
 * async function (draft -> validate -> retry once if invalid). This is
 * intentionally shaped like a 2-node graph so it can be converted into
 * an actual LangGraph StateGraph later without changing the interface
 * that callers (routes/ideas.js) depend on.
 */
async function runBlogGraph(item, opts = {}) {
  const targetWords = opts.targetWords || process.env.BLOG_TARGET_WORDS || 800;
  const maxRetries = opts.maxRetries ?? 1;

  let lastBlog = null;
  let lastIssues = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt = buildBlogPrompt(item, targetWords);
    const rawText = await callClaude({
      model: process.env.CLAUDE_MODEL,
      maxTokens: Number(process.env.CLAUDE_MAX_TOKENS_BLOG) || 3000,
      prompt,
    });

    const parsed = stripEmDashesDeep(JSON.parse(extractJsonBlock(rawText)));
    const { valid, issues } = validateBlog(parsed);

    lastBlog = parsed;
    lastIssues = issues;

    if (valid) {
      return { blog: parsed, valid: true, issues: [] };
    }
    // else loop again if attempts remain
  }

  // Ran out of retries — return the last attempt anyway, flagged as invalid,
  // so a human reviewer sees it in the queue with a warning rather than it
  // silently vanishing.
  return { blog: lastBlog, valid: false, issues: lastIssues };
}

module.exports = { runBlogGraph, buildBlogPrompt, validateBlog };
