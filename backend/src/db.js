const dns = require("dns");
const { createClient } = require("@libsql/client");

// On networks with NAT64/DNS64 (common on some VPNs/ISPs), Node's default
// DNS ordering can return a synthesized IPv6 address before the real IPv4
// one for hosts that don't actually support IPv6. undici's fetch (used
// internally by @libsql/client's HTTP transport) then hangs on that dead
// IPv6 path until it eats the whole connect timeout, before ever trying
// IPv4 - which fails outright rather than falling back quickly. Forcing
// IPv4-first avoids that class of failure entirely. Must be set before
// any network calls happen, and applies process-wide, so this needs to
// run here (loaded by every entry point that talks to Turso) rather than
// only in index.js.
dns.setDefaultResultOrder("ipv4first");

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      raw_count INTEGER,
      filtered_count INTEGER,
      deduped_count INTEGER,
      sent_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      item_json TEXT NOT NULL,
      keyword TEXT NOT NULL,
      search_volume INTEGER,
      competition TEXT,
      is_bucketed INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new', -- new | drafted | dismissed
      draft_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  try {
    await db.execute(`ALTER TABLE ideas ADD COLUMN serp_results_json TEXT`);
  } catch (err) {
    // column already exists, ignore
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS serp_cache (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      results_json TEXT NOT NULL,
      checked_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_keyword_volume (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL UNIQUE,
      search_volume INTEGER,
      competition TEXT,
      is_bucketed INTEGER DEFAULT 0,
      checked_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      reset_token TEXT,
      reset_token_expires TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Started once at module load; index.js awaits this before app.listen() so
// the server never accepts requests before tables exist. Other modules
// don't need to await this themselves - by the time any HTTP request
// reaches a route handler, index.js has already resolved it.
const ready = initDb();

module.exports = { db, ready };
