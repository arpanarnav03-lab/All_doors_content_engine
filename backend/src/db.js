const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "drafts.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    item_json TEXT NOT NULL,
    original_blog_json TEXT NOT NULL,
    final_blog_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    blog_doc_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    approved_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS pipeline_runs (
    id TEXT PRIMARY KEY,
    raw_count INTEGER,
    filtered_count INTEGER,
    deduped_count INTEGER,
    sent_count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

module.exports = db;
