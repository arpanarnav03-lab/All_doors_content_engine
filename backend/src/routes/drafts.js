const express = require("express");
const db = require("../db");
const { sendToAppsScript } = require("../services/appsScriptClient");

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
router.get("/", (req, res) => {
  const status = req.query.status || "pending";
  const rows = db
    .prepare("SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC")
    .all(status);
  res.json(rows.map(rowToDraft));
});

// GET /api/drafts/stats
router.get("/stats", (req, res) => {
  const pending = db.prepare("SELECT COUNT(*) c FROM drafts WHERE status='pending'").get().c;
  const approvedToday = db
    .prepare("SELECT COUNT(*) c FROM drafts WHERE status='approved' AND date(approved_at) = date('now')")
    .get().c;
  const totalThisWeek = db
    .prepare("SELECT COUNT(*) c FROM drafts WHERE created_at >= datetime('now', '-7 days')")
    .get().c;
  res.json({ pending, approvedToday, totalThisWeek });
});

// GET /api/drafts/:id
router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(rowToDraft(row));
});

// PATCH /api/drafts/:id  - save edits without approving
router.patch("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  const current = JSON.parse(row.final_blog_json);
  const { headline, metaDescription, body } = req.body;
  const updated = {
    ...current,
    headline: headline ?? current.headline,
    metaDescription: metaDescription ?? current.metaDescription,
    body: body ?? current.body,
  };

  db.prepare("UPDATE drafts SET final_blog_json = ? WHERE id = ?").run(
    JSON.stringify(updated),
    req.params.id
  );

  res.json({ ok: true, blog: updated });
});

// POST /api/drafts/:id/approve
router.post("/:id/approve", async (req, res) => {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  const item = JSON.parse(row.item_json);
  const blog = JSON.parse(row.final_blog_json);

  try {
    const result = await sendToAppsScript({ action: "createDraft", item, blog });

    db.prepare(
      `UPDATE drafts SET status = 'approved', blog_doc_url = ?, approved_at = datetime('now') WHERE id = ?`
    ).run(result.blogDocUrl || "", req.params.id);

    res.json({ ok: true, blogDocUrl: result.blogDocUrl });
  } catch (err) {
    console.error("Approve failed:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// POST /api/drafts/:id/reject
router.post("/:id/reject", (req, res) => {
  const row = db.prepare("SELECT * FROM drafts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  db.prepare("UPDATE drafts SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
