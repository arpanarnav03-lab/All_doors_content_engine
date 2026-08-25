const express = require("express");
const { db } = require("../db");
const { sendToAppsScript } = require("../services/appsScriptClient");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

function rowToDraft(row) {
  return {
    id: row.id,
    status: row.status,
    blogDocUrl: row.blog_doc_url,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    item: JSON.parse(row.item_json),
    originalBlog: JSON.parse(row.original_blog_json),
    blog: JSON.parse(row.final_blog_json),
  };
}

// GET /api/drafts?status=pending  (default: pending)
router.get("/", asyncHandler(async (req, res) => {
  const status = req.query.status || "pending";
  const result = await db.execute({
    sql: "SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC",
    args: [status],
  });
  res.json(result.rows.map(rowToDraft));
}));

// GET /api/drafts/stats
router.get("/stats", asyncHandler(async (req, res) => {
  const pendingResult = await db.execute("SELECT COUNT(*) c FROM drafts WHERE status='pending'");
  const approvedTodayResult = await db.execute(
    "SELECT COUNT(*) c FROM drafts WHERE status='approved' AND date(approved_at) = date('now')"
  );
  const totalThisWeekResult = await db.execute(
    "SELECT COUNT(*) c FROM drafts WHERE created_at >= datetime('now', '-7 days')"
  );
  res.json({
    pending: pendingResult.rows[0].c,
    approvedToday: approvedTodayResult.rows[0].c,
    totalThisWeek: totalThisWeekResult.rows[0].c,
  });
}));

// GET /api/drafts/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM drafts WHERE id = ?", args: [req.params.id] });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(rowToDraft(row));
}));

// PATCH /api/drafts/:id  - save edits without approving
router.patch("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM drafts WHERE id = ?", args: [req.params.id] });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not found" });

  const current = JSON.parse(row.final_blog_json);
  const { headline, metaDescription, body } = req.body;
  const updated = {
    ...current,
    headline: headline ?? current.headline,
    metaDescription: metaDescription ?? current.metaDescription,
    body: body ?? current.body,
  };

  await db.execute({
    sql: "UPDATE drafts SET final_blog_json = ? WHERE id = ?",
    args: [JSON.stringify(updated), req.params.id],
  });

  res.json({ ok: true, blog: updated });
}));

// POST /api/drafts/:id/approve
router.post("/:id/approve", asyncHandler(async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM drafts WHERE id = ?", args: [req.params.id] });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not found" });

  const item = JSON.parse(row.item_json);
  const blog = JSON.parse(row.final_blog_json);

  try {
    const approveResult = await sendToAppsScript({ action: "createDraft", item, blog });

    await db.execute({
      sql: `UPDATE drafts SET status = 'approved', blog_doc_url = ?, approved_at = datetime('now') WHERE id = ?`,
      args: [approveResult.blogDocUrl || "", req.params.id],
    });

    res.json({ ok: true, blogDocUrl: approveResult.blogDocUrl });
  } catch (err) {
    console.error("Approve failed:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}));

// POST /api/drafts/:id/reject
router.post("/:id/reject", asyncHandler(async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM drafts WHERE id = ?", args: [req.params.id] });
  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: "not found" });

  await db.execute({ sql: "UPDATE drafts SET status = 'rejected' WHERE id = ?", args: [req.params.id] });
  res.json({ ok: true });
}));

module.exports = router;
