/**
 * ONE-TIME MIGRATION SCRIPT
 * -------------------------
 * Copies all data from the old local better-sqlite3 database
 * (backend/drafts.db) into the new Turso database this project now uses.
 *
 * Run manually from the backend/ directory:
 *   node scripts/migrateLocalDataToTurso.js
 *
 * NOT imported by index.js or any route, NOT run automatically by
 * npm start or npm install. Safe to re-run - uses INSERT OR IGNORE keyed
 * on each row's existing primary key, so a second run just skips rows
 * that already made it across.
 */
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { db, ready } = require("../src/db");

const OLD_DB_PATH = path.join(__dirname, "..", "drafts.db");

async function migrateTable(oldDb, table) {
  const rows = oldDb.prepare(`SELECT * FROM ${table}`).all();
  console.log(`\n[${table}] ${rows.length} row(s) found in old database`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
    const args = columns.map((c) => row[c]);

    try {
      const result = await db.execute({ sql, args });
      if (result.rowsAffected > 0) {
        migrated++;
      } else {
        skipped++; // primary key already existed in Turso
      }
    } catch (err) {
      failed++;
      console.error(`  [${table}] Failed to insert row id=${row.id ?? "?"}: ${err.message}`);
    }
  }

  console.log(`[${table}] migrated=${migrated} skipped=${skipped} failed=${failed}`);
  return { migrated, skipped, failed };
}

async function main() {
  if (!fs.existsSync(OLD_DB_PATH)) {
    console.log("No local drafts.db found, nothing to migrate.");
    return;
  }

  await ready; // make sure Turso tables exist before we insert into them

  const oldDb = new Database(OLD_DB_PATH, { readonly: true });

  const tables = oldDb
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);

  console.log(`Found ${tables.length} table(s) in ${OLD_DB_PATH}: ${tables.join(", ") || "(none)"}`);

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const table of tables) {
    const { migrated, skipped, failed } = await migrateTable(oldDb, table);
    totalMigrated += migrated;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  oldDb.close();

  console.log("\n=== Migration summary ===");
  console.log(`Tables processed: ${tables.length}`);
  console.log(`Total rows migrated: ${totalMigrated}`);
  console.log(`Total rows skipped (already existed): ${totalSkipped}`);
  console.log(`Total rows failed: ${totalFailed}`);
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error("Migration failed with an unexpected error:");
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
