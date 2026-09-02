const express = require("express");
const crypto = require("crypto");
const { db } = require("../db");
const requireServiceKey = require("../middleware/requireServiceKey");
const { runBlogGraph } = require("../graph/blogGraph");
const { extractPrimaryKeyword } = require("../services/keywordExtraction");
const { getKeywordVolume } = require("../services/keywordPlanner");
const { checkKeywordSerp, normalizeSerpResults } = require("../services/serpCheck");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function rowToIdea(row) {
  return {
    id: row.id,
    item: JSON.parse(row.item_json),
    keyword: row.keyword,
    searchVolume: row.search_volume,
    competition: row.competition,
    isBucketed: !!row.is_bucketed,
    serpResults: normalizeSerpResults(row.serp_results_json ? JSON.parse(row.serp_results_json) : null),
    status: row.status,
    draftId: row.draft_id,
    createdAt: row.created_at,
  };
}

/**
 * POST /api/ideas
 * Called by Apps Script's sendItemsToNodeApp() after fetchRSSFeeds() +
 * processWithClaude() have already filtered/deduped/summarized items.
 * Body: { items: [ processedItem, ... ] }
 *
 * Triage only: extracts a primary keyword + its search volume per item and
 * stores a lightweight `ideas` row. No blog draft is written here anymore -
 * that only happens once a human picks an idea via POST /:id/generate-draft.
 */
router.post("/", requireServiceKey, asyncHandler(async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: "items array is required" });
  }

  const createdIds = [];
  const errors = [];

  for (const item of items) {
    try {
      const keyword = await extractPrimaryKeyword(item);
      if (!keyword) throw new Error("Could not extract a primary keyword");

      const volume = await getKeywordVolume(keyword); // null if Ads API unconfigured/failed

      let serpResults = { topResults: [], relatedQuestions: [] };
      try {
        serpResults = await checkKeywordSerp(keyword);
      } catch (serpErr) {
        // Shouldn't happen (checkKeywordSerp handles its own errors), but
        // don't let a SERP failure block idea creation either way.
        console.error("SERP check failed for keyword:", keyword, serpErr);
        serpResults = { topResults: [], relatedQuestions: [] };
      }

      const id = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO ideas (id, item_json, keyword, search_volume, competition, is_bucketed,
              serp_results_json, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
        args: [
          id,
          JSON.stringify(item),
          keyword,
          volume ? volume.search_volume : null,
          volume ? volume.competition : null,
          volume && volume.is_bucketed ? 1 : 0,
          JSON.stringify(serpResults),
        ],
      });

      createdIds.push(id);
    } catch (err) {
      console.error("Failed to create idea for item:", item.Title, err);
      errors.push({ title: item.Title, error: String(err.message || err) });
    }
  }

  res.json({ ok: true, created: createdIds.length, ids: createdIds, errors });
}));

/**
 * POST /api/ideas/pipeline-runs
 * Optional: Apps Script can also POST a summary of each run here for the
 * Activity dashboard page.
 */
router.post("/pipeline-runs", requireServiceKey, asyncHandler(async (req, res) => {
  const { rawCount, filteredCount, dedupedCount, sentCount } = req.body;
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO pipeline_runs (id, raw_count, filtered_count, deduped_count, sent_count)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, rawCount || 0, filteredCount || 0, dedupedCount || 0, sentCount || 0],
  });
  res.json({ ok: true });
}));

// GET /api/ideas?status=new  (dashboard - no service key required)
router.get("/", asyncHandler(async (req, res) => {
  const status = req.query.status || "new";
  const result = await db.execute({
    sql: "SELECT * FROM ideas WHERE status = ? ORDER BY created_at DESC",
    args: [status],
  });
  res.json(result.rows.map(rowToIdea));
}));

// POST /api/ideas/:id/generate-draft  (dashboard - no service key required)
// Runs the same generation logic the old intake handler used to run
// unconditionally, but now only for an idea a human picked.
router.post("/:id/generate-draft", asyncHandler(async (req, res) => {
  const ideaResult = await db.execute({ sql: "SELECT * FROM ideas WHERE id = ?", args: [req.params.id] });
  const idea = ideaResult.rows[0];
  if (!idea) return res.status(404).json({ ok: false, error: "idea not found" });
  if (idea.status !== "new") {
    return res.status(409).json({ ok: false, error: `idea already ${idea.status}` });
  }

  const item = JSON.parse(idea.item_json);
  const serpData = normalizeSerpResults(idea.serp_results_json ? JSON.parse(idea.serp_results_json) : null);

  try {
    const { blog, valid, issues } = await runBlogGraph(item, {
      keywordData: { relatedQuestions: serpData.relatedQuestions },
    });

    if (!blog) {
      return res.status(502).json({
        ok: false,
        error: "Blog generation failed after retries: " + issues.join(", "),
      });
    }

    const draftId = crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO drafts (id, item_json, original_blog_json, final_blog_json, status)
            VALUES (?, ?, ?, ?, 'pending')`,
      args: [
        draftId,
        JSON.stringify(item),
        JSON.stringify({ ...blog, _valid: valid, _issues: issues }),
        JSON.stringify(blog),
      ],
    });

    await db.execute({
      sql: "UPDATE ideas SET status = 'drafted', draft_id = ? WHERE id = ?",
      args: [draftId, idea.id],
    });

    res.json({ ok: true, draftId });
  } catch (err) {
    console.error("Failed to generate draft for idea:", idea.id, err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}));

// POST /api/ideas/:id/dismiss  (dashboard - no service key required)
router.post("/:id/dismiss", asyncHandler(async (req, res) => {
  const ideaResult = await db.execute({ sql: "SELECT * FROM ideas WHERE id = ?", args: [req.params.id] });
  const idea = ideaResult.rows[0];
  if (!idea) return res.status(404).json({ ok: false, error: "idea not found" });
  if (idea.status !== "new") {
    return res.status(409).json({ ok: false, error: `idea already ${idea.status}` });
  }

  await db.execute({ sql: "UPDATE ideas SET status = 'dismissed' WHERE id = ?", args: [idea.id] });
  res.json({ ok: true });
}));

module.exports = router;
