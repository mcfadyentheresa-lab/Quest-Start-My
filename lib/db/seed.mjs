import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PORTFOLIO_STATUS_BY_NAME = {
  "Aster & Spruce Connect": "Active",
  "Quest Workday": "Active",
  "Circadian App": "Warm",
  "AI Assistant Helper": "Warm",
};

const FIFTH_AREA = {
  name: "Books / Digital Products",
  priority: "P4",
  description: "Written and digital product creation",
  is_active_this_week: false,
  color: "#a78bfa",
  portfolio_status: "Parked",
};

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding Phase 2 area data (name-based, idempotent)...");

    for (const [name, status] of Object.entries(PORTFOLIO_STATUS_BY_NAME)) {
      const result = await client.query(
        "SELECT id, portfolio_status FROM areas WHERE name = $1",
        [name]
      );
      if (result.rows.length === 0) {
        console.log(`Area "${name}" not found, skipping`);
        continue;
      }
      const row = result.rows[0];
      if (row.portfolio_status !== status) {
        await client.query(
          "UPDATE areas SET portfolio_status = $1 WHERE name = $2",
          [status, name]
        );
        console.log(`Updated "${name}" portfolio_status → ${status}`);
      } else {
        console.log(`"${name}" already has portfolio_status = ${status}, skipping`);
      }
    }

    const fifth = await client.query(
      "SELECT id, portfolio_status FROM areas WHERE name = $1",
      [FIFTH_AREA.name]
    );

    if (fifth.rows.length === 0) {
      await client.query(
        `INSERT INTO areas (name, priority, description, is_active_this_week, color, portfolio_status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          FIFTH_AREA.name,
          FIFTH_AREA.priority,
          FIFTH_AREA.description,
          FIFTH_AREA.is_active_this_week,
          FIFTH_AREA.color,
          FIFTH_AREA.portfolio_status,
        ]
      );
      console.log(`Inserted "${FIFTH_AREA.name}" (P4, Parked)`);
    } else if (fifth.rows[0].portfolio_status !== FIFTH_AREA.portfolio_status) {
      await client.query(
        "UPDATE areas SET portfolio_status = $1 WHERE name = $2",
        [FIFTH_AREA.portfolio_status, FIFTH_AREA.name]
      );
      console.log(`Updated "${FIFTH_AREA.name}" portfolio_status → ${FIFTH_AREA.portfolio_status}`);
    } else {
      console.log(`"${FIFTH_AREA.name}" already seeded correctly, skipping`);
    }

    console.log("Seed complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
