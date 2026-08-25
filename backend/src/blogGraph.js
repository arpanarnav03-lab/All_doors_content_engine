const { callClaude } = require("./services/claude");
const { extractJsonBlock, stripEmDashesDeep } = require("./utils/text");

/**
 * Builds the exact prompt used by Apps Script's generateBlogPost(), so
 * output shape/quality stays consistent with what you had before.
 */
function buildBlogPrompt(item, targetWords, keywordData) {
  const relatedQuestions = (keywordData && keywordData.relatedQuestions) || [];
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
    "project type, a market mechanism, a regulation, a partnership, a company move) - this " +
    "becomes your target keyword, repeated naturally throughout headers and body text the " +
    "way authoritative reference content does, without keyword-stuffing.\n\n" +
    "SEARCH INTENT: before writing, determine what a reader searching for this topic is " +
    "actually trying to find out - are they looking for a quick fact/definition " +
    "(informational), comparing options before a decision (commercial), or ready to act " +
    "(transactional)? Write the entire article to satisfy that specific intent directly - " +
    "don't pad with tangential background the searcher didn't ask for. If the intent is " +
    "informational, prioritize a clear, direct answer over persuasive framing. If it's " +
    "commercial/transactional in nature (e.g. the reader is weighing whether to buy now), " +
    "make sure the article gives them enough to actually decide, not just context.\n\n" +
    "HEADLINE STYLE: keep the headline direct and simple, not descriptive or keyword-stuffed. " +
    "Prefer a short, punchy phrase that still identifies the specific subject clearly, over " +
    "a full sentence - e.g. 'Namma Metro Phase 3 Approved' rather than 'Namma Metro Phase 3 " +
    "Approved: What the JP Nagar-Hebbal Line Means for Bengaluru Property Prices'. Include " +
    "enough specificity that a reader immediately knows which project, policy, or event this " +
    "is about (e.g. keep 'Phase 3', a project name, or a locality if that's what distinguishes " +
    "this story from similar ones) - do not shorten to the point of vagueness. Aim for " +
    "roughly 5-9 words where the news genuinely supports it.\n\n" +
    "KEYWORD PLACEMENT: place the primary keyword naturally in these specific locations: " +
    "the headline, the first sentence of the opening paragraph, at least one H2 heading, " +
    "the meta description, and once more naturally within the Conclusion. Do not repeat " +
    "the exact keyword phrase more than once in the same paragraph, and never force it " +
    "into a sentence where it reads unnaturally - rephrase the sentence instead of " +
    "dropping the keyword in verbatim if it doesn't fit grammatically.\n\n" +
    "FACTUAL GROUNDING (critical): facts, figures, names, dates, and quotes from the source " +
    "are NOT copyrighted and MUST be used, stated directly in your own sentence structure - " +
    "only copying the source's exact phrasing is prohibited. Do not omit concrete details " +
    "(dates, figures, spokesperson names, specific numbers, locations, amounts) in the name " +
    "of avoiding copying. Paraphrase quotes rather than dropping them entirely. The article " +
    "must include at least 4-5 concrete facts from the source, integrated naturally into the " +
    "body - an article built mostly from speculation without grounding in the actual " +
    "reported facts is incomplete and unacceptable.\n\n" +
    "Structure the body EXACTLY as follows, in this order:\n\n" +
    "DIRECT ANSWER FIRST: the very first sentence of the opening paragraph must directly " +
    "answer the core question a reader searching this topic would have (what happened, what " +
    "it is, or what the key fact is) - not a scene-setting lead-in. A reader should get the " +
    "single most important fact within the first sentence, before any elaboration, context, " +
    "or why-it-matters framing follows.\n\n" +
    "1. OPENING DEFINITION (no subheading, goes directly under the title): 3-5 sentences " +
    "that directly and authoritatively answer 'what is [topic]' or 'what happened' as if " +
    "opening a reference entry, and fully explain the concept clearly for someone " +
    "encountering it for the first time - there is no separate definitional section later " +
    "in the structure, so this opening paragraph carries that full weight on its own. No " +
    "throat-clearing, no 'in this article we will discuss'. State the core fact/definition " +
    "immediately, using real specifics from the source, then explain why it matters to a " +
    "Bangalore homebuyer, renter, or investor.\n\n" +
    "2. \"## Why [Topic] Matters\" or equivalent - open with one framing sentence, then a " +
    "short bolded lead-in line like 'Key reasons this matters:' followed by 4-6 bullet " +
    "points, each a short punchy phrase (not full sentences). Close with one sentence " +
    "tying the bullets back to the main keyword/topic.\n\n" +
    "3. \"## How [Topic] Works\" or \"## What This Means For [Locality/Buyers]\" - open with " +
    "a framing paragraph, then break into 3-5 sub-topics. For EACH sub-topic, use a genuine " +
    "H3 sub-heading marked with \"### \" on its own line (e.g. \"### Timeline and " +
    "approvals\"), immediately followed by 2-4 sentences of explanation as a normal " +
    "paragraph below it. Keep each H3 sub-heading short (3-6 words), stating the sub-topic " +
    "directly. Within each sub-topic's explanation paragraph, lead with the direct answer " +
    "or key point for that sub-topic FIRST, then explain the reasoning or context after. " +
    "Do not build up to the point through background before stating it - state it, then " +
    "support it. This applies to the Who Benefits section too: each group's paragraph " +
    "(below its H3) should open by stating the specific benefit directly, not building " +
    "toward it through preamble.\n\n" +
    "4. WITHIN one of the sections above, include a genuine INFERENCE not stated in the " +
    "source article - a reasonable conclusion a knowledgeable local real estate observer " +
    "would draw, based on real signals in the source text (numbers, timing, precedent, " +
    "comparable areas). Signal this is analysis, not a reported fact, but VARY the phrasing " +
    "you use to signal this each time - do not default to the same transitional phrase " +
    "(e.g. do not always say 'reading between the lines here' or always say 'what this " +
    "likely means, though it's not explicitly stated, is'). Choose wording that fits this " +
    "specific article naturally. If nothing is genuinely inferable, fall back to the unique " +
    "insight provided above instead of inventing a stretch.\n\n" +
    "5. \"## [Topic] vs [Comparable Alternative]\" (only include this section if a " +
    "genuine comparison exists - e.g. this locality vs a comparable one, buying now vs " +
    "waiting, this project type vs another). Open with a framing paragraph on why the " +
    "comparison matters, then include a comparison TABLE (see TABLES instructions " +
    "below), then a closing paragraph interpreting what the comparison means for the " +
    "reader. Skip this entire section if no genuine comparison exists in the source " +
    "material - do not force one.\n\n" +
    "6. \"## Who Benefits From [Topic]\" - identify 3-4 distinct groups affected by this " +
    "news (e.g. homeowners near the relevant area, investors, renters/tenants, or other " +
    "specific groups relevant to this particular article - choose whichever groups " +
    "genuinely apply, don't force all four if fewer are relevant). For EACH group, use a " +
    "genuine H3 sub-heading marked with \"### \" stating who the group is (e.g. " +
    "\"### Investors\" or \"### Homeowners near [locality]\"), immediately followed by 2-3 " +
    "sentences explaining the specific benefit or impact for that group, grounded in the " +
    "article's actual facts.\n\n" +
    "7. \"## Conclusion\" - 2-3 short paragraphs (not one dense block): first restates the " +
    "core fact/definition and why it matters, second connects it to the bigger picture " +
    "(the locality's or Bangalore's broader trajectory), third gives a clear, direct " +
    "closing takeaway sentence.\n\n" +
    "8. \"## FAQs\" - 6-8 question-and-answer pairs a Bangalore homebuyer/investor " +
    "searching about this topic would realistically ask, ordered from most basic " +
    "('What is [topic]?') to more specific/practical. Format each pair as the question " +
    "on its own line immediately followed by a 2-4 sentence answer (denser and more " +
    "complete than a one-liner - each answer should be able to stand alone as a full " +
    "explanation), with a blank line between separate Q&A pairs. Base these on the " +
    "actual content, not generic filler. VARY how each answer opens - do not start most " +
    "or all answers with the same hedge phrase (e.g. do not always begin with 'Not " +
    "necessarily, but...'). Answer directly and vary sentence openings naturally.\n\n" +
    "REAL SEARCHED QUESTIONS: here are actual questions Google shows people also ask for " +
    "this topic's keyword: " + (relatedQuestions && relatedQuestions.length > 0 ?
    relatedQuestions.map(q => q.question).join(" | ") : "none available for this keyword") +
    "\n" +
    "Where any of these real questions genuinely fit this article's content, use them as " +
    "FAQ questions, matching their exact or near-exact phrasing rather than rewriting them - " +
    "real searched phrasing is more likely to match what readers actually search for. Fill " +
    "any remaining FAQ slots with additional relevant questions based on the article's " +
    "content if fewer than 6 of the provided questions are relevant or none were provided. " +
    "Still apply the NO CONTENT DUPLICATION rule below to these questions same as any other " +
    "FAQ - a real searched question is still skipped if its answer would just restate body " +
    "content already covered.\n\n" +
    "NO CONTENT DUPLICATION BETWEEN BODY AND FAQs: before finalizing your FAQs, check " +
    "every fact, figure, or explanation you plan to include against what the body sections " +
    "above already cover. If an FAQ question's answer would just restate something already " +
    "explained in a body section (the same fact, cost, location, or definition), do NOT " +
    "include that FAQ - either it belongs in the body only, or the body doesn't need it and " +
    "the FAQ can cover it instead, but never both. As a rule: if a fact is central to " +
    "understanding the article, explain it once in the body, not again in an FAQ. If a fact " +
    "is minor, specific, or a natural follow-up question a reader would ask after already " +
    "understanding the body, save it for the FAQ instead of cramming it into a body section. " +
    "Each FAQ should teach the reader something the body did not already state. If applying " +
    "this rule leaves fewer than 6 genuinely non-duplicated questions, it is fine to include " +
    "only as many FAQs as pass this check rather than padding with restated content - " +
    "quality and non-duplication matter more than hitting a fixed count.\n\n" +
    "TABLES: include one if section 5 (comparison) is used, or if the data points " +
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
    "- ATTRIBUTION: where you state a fact or figure from the source, attribute it lightly " +
    "and naturally where it reads well (e.g. 'according to the cabinet's announcement,' " +
    "'official figures show,' 'the developer confirmed') rather than stating every fact as " +
    "if it's common knowledge. Don't over-attribute every sentence, just enough that a " +
    "reader can tell which claims are sourced versus analytical.\n" +
    "- TIME-ANCHORING: for claims tied to a specific date, timeline, or figure that could " +
    "change (construction start dates, prices, policy status), phrase them clearly relative " +
    "to when this article was written (using the article's Date field: " + item.Date + ") " +
    "so the article reads accurately even if read months later. Avoid phrasing that implies " +
    "permanence for things that are time-bound.\n" +
    "- Write in Indian English throughout: use British/Indian spelling conventions " +
    "(e.g. 'organisation' not 'organization', 'colour' not 'color', 'realise' not " +
    "'realize', 'centre' not 'center', 'programme' not 'program', 'favour' not 'favor', " +
    "'analyse' not 'analyze'). Use Indian numbering conventions where natural (lakh, " +
    "crore) alongside or instead of million/billion when referring to Indian currency " +
    "or figures, matching how the source data expresses them. Avoid American-only " +
    "idioms, phrasing, or spellings throughout the headline, meta description, and " +
    "body.\n" +
    "- EXPLAIN UNCOMMON TERMS ON FIRST USE, BRIEFLY: any acronym, industry jargon, or " +
    "specialized concept a general homebuyer/investor wouldn't already know must be " +
    "expanded the FIRST time it appears, not later in the article. This includes " +
    "acronyms (spell out in full, e.g. 'facility management (FM) companies' not just " +
    "'FM companies'), regulatory/legal terms, real estate jargon (Grade-A/Grade-B, " +
    "absorption, micro-market), company/organization types, and any concept a layperson " +
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
    "verbatim, but DO state the actual facts (see FACTUAL GROUNDING above).\n" +
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
  const keywordData = opts.keywordData || {};

  let lastBlog = null;
  let lastIssues = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const prompt = buildBlogPrompt(item, targetWords, keywordData);
    const rawText = await callClaude({
      model: process.env.CLAUDE_MODEL,
      maxTokens: Number(process.env.CLAUDE_MAX_TOKENS_BLOG) || 3000,
      prompt,
    });

    let parsed;
    try {
      parsed = stripEmDashesDeep(JSON.parse(extractJsonBlock(rawText)));
    } catch (parseErr) {
      console.error(
        `JSON parse failed on attempt ${attempt} for "${item.Headline}": ${parseErr.message}`
      );
      lastBlog = null;
      lastIssues = [`Malformed JSON response: ${parseErr.message}`];
      continue; // skip validation this iteration, let the loop retry
    }

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
  // silently vanishing. If every attempt failed to even parse, lastBlog is
  // still null here - callers must handle that case rather than assume a
  // blog object is always present.
  return {
    blog: lastBlog,
    valid: false,
    issues: lastBlog ? lastIssues : ["All generation attempts returned malformed JSON"],
  };
}

module.exports = { runBlogGraph, buildBlogPrompt, validateBlog };
