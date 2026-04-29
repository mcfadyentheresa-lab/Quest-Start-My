// Standalone migration runner for the pillars→areas rename (Phase 8).
//
// Drizzle's migrator is journal-based and the project does not yet have a
// generated baseline, so this script applies the rename SQL directly. It is
// idempotent — re-running after success is a no-op because every statement
// uses IF EXISTS and re-renaming a column that doesn't exist (because it was
// already renamed) errors gracefully which we catch.
//
// Usage:
//   node migrate-rename.mjs up
//   node migrate-rename.mjs down

import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const direction = process.argv[2] === "down" ? "down" : "up";
const file = direction === "down"
  ? "migrations/0001_rename_pillars_to_areas.down.sql"
  : "migrations/0001_rename_pillars_to_areas.sql";

const sql = fs.readFileSync(path.join(__dirname, file), "utf8");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("BEGIN");
  for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
    if (stmt.startsWith("--")) continue;
    try {
      await pool.query(stmt);
    } catch (err) {
      // Tolerate "column does not exist" / "relation does not exist" so the
      // script remains idempotent across partial states.
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist/i.test(msg)) {
        console.warn(`skip (already applied): ${stmt.split("\n")[0]}`);
        continue;
      }
      throw err;
    }
  }
  await pool.query("COMMIT");
  console.log(`Migration ${direction} complete.`);
} catch (err) {
  await pool.query("ROLLBACK").catch(() => {});
  console.error(`Migration ${direction} failed:`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
