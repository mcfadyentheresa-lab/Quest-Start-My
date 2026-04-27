import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set to run migrations.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "migrations");

const ownerUserId = process.env.OWNER_USER_ID || "owner";
const ownerEmail = process.env.OWNER_EMAIL || "info@asterandspruceliving.ca";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set GUCs read by phase-2 migration so the owner user/backfill values are
// driven by env (OWNER_USER_ID, OWNER_EMAIL) without hardcoding.
pool.on("connect", (client) => {
  client.query(
    "SELECT set_config('app.owner_user_id', $1, false), set_config('app.owner_email', $2, false)",
    [ownerUserId, ownerEmail],
  );
});

const db = drizzle(pool);

try {
  console.log(`Running migrations from ${migrationsFolder}`);
  console.log(`Owner user: ${ownerUserId} <${ownerEmail}>`);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
