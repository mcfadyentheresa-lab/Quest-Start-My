// Standalone idempotent migration runner.
//
// Drizzle's journal-based migrator does not have a generated baseline for this
// project, and `drizzle-kit push --force` has proven unreliable in production
// when the live DB is in a partial state (it has silently exited 0 without
// creating critical tables like `areas`). This script applies a deterministic
// list of hand-written SQL files at startup, each idempotent, so the schema
// is guaranteed to be in the expected shape before the server starts.
//
// On `up`, files run in order. On `down`, the rename's down migration runs
// (used only for local rollback experiments — production never invokes down).
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

// Ordered list of SQL files to apply on `up`. Each must be idempotent.
const upFiles = [
  "migrations/0001_rename_pillars_to_areas.sql",
  "migrations/0002_daily_recaps.sql",
  "migrations/0003_ensure_areas.sql",
  "migrations/0004_milestones_completed_at.sql",
  "migrations/0005_user_scope.sql",
];
const downFiles = ["migrations/0001_rename_pillars_to_areas.down.sql"];
const files = direction === "down" ? downFiles : upFiles;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), "utf8");
    console.log(`Applying ${file}...`);
    await pool.query("BEGIN");
    try {
      // Strip line comments before splitting so a leading `-- header` doesn't
      // make the entire first statement look like a comment after split. Each
      // line that starts with `--` (after optional whitespace) is removed.
      const stripped = sql
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n");
      for (const stmt of stripped.split(";").map((s) => s.trim()).filter(Boolean)) {
        try {
          await pool.query(stmt);
        } catch (err) {
          // Tolerate "already exists" / "does not exist" so the script
          // remains idempotent across partial states.
          const msg = err instanceof Error ? err.message : String(err);
          if (/does not exist|already exists/i.test(msg)) {
            console.warn(`  skip (idempotent): ${stmt.split("\n")[0]}`);
            continue;
          }
          throw err;
        }
      }
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK").catch(() => {});
      throw err;
    }
  }
  console.log(`Migration ${direction} complete.`);
} catch (err) {
  console.error(`Migration ${direction} failed:`, err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
