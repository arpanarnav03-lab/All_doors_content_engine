const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { runBlogGraph } = require("../blogGraph");

const router = express.Router();

/**
 * POST /api/ideas
 * Called by Apps Script's sendItemsToNodeApp() after fetchRSSFeeds() +
 * processWithClaude() have already filtered/deduped/summarized items.
 * Body: { items: [ processedItem, ... ] }
 */
router.post("/", async (req, res) => {
  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: "items array is required" });
  }

  const createdIds = [];
  const errors = [];

  for (const item of items) {
    try {
      const { blog, valid, issues } = await runBlogGraph(item);
      const id = crypto.randomUUID();

      db.prepare(
        `INSERT INTO drafts (id, item_json, original_blog_json, final_blog_json, status)
         VALUES (?, ?, ?, ?, 'pending')`
      ).run(id, JSON.stringify(item), JSON.stringify({ ...blog, _valid: valid, _issues: issues }), JSON.stringify(blog));

      createdIds.push(id);
    } catch (err) {
      console.error("Failed to generate draft for item:", item.Title, err);
      errors.push({ title: item.Title, error: String(err.message || err) });
    }
  }

  res.json({ ok: true, created: createdIds.length, ids: createdIds, errors });
});

/**
 * POST /api/pipeline-runs
 * Optional: Apps Script can also POST a summary of each run here for the
 * Activity dashboard page.
 */
router.post("/pipeline-runs", (req, res) => {
  const { rawCount, filteredCount, dedupedCount, sentCount } = req.body;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO pipeline_runs (id, raw_count, filtered_count, deduped_count, sent_count)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, rawCount || 0, filteredCount || 0, dedupedCount || 0, sentCount || 0);
  res.json({ ok: true });
});

module.exports = router;
