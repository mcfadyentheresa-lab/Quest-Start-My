import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log("Seeding Phase 2 pillar data...");

    const portfolioUpdates = [
      { id: 1, status: "Active" },
      { id: 2, status: "Active" },
      { id: 3, status: "Warm" },
      { id: 4, status: "Warm" },
    ];

    for (const { id, status } of portfolioUpdates) {
      const result = await client.query("SELECT id, portfolio_status FROM pillars WHERE id = $1", [id]);
      if (result.rows.length > 0 && result.rows[0].portfolio_status === null) {
        await client.query("UPDATE pillars SET portfolio_status = $1 WHERE id = $2", [status, id]);
        console.log(`Updated pillar ${id} portfolio_status → ${status}`);
      } else {
        console.log(`Pillar ${id} already has portfolio_status (${result.rows[0]?.portfolio_status}), skipping`);
      }
    }

    const fifth = await client.query("SELECT id, portfolio_status FROM pillars WHERE id = 5");
    if (fifth.rows.length === 0) {
      await client.query(
        `INSERT INTO pillars (name, priority, description, is_active_this_week, color, portfolio_status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["Books / Digital Products", "P4", "Written and digital product creation", false, "#a78bfa", "Parked"]
      );
      console.log("Inserted 5th pillar: Books / Digital Products (P4, Parked)");
    } else if (fifth.rows[0].portfolio_status === null) {
      await client.query("UPDATE pillars SET portfolio_status = $1 WHERE id = 5", ["Parked"]);
      console.log("Updated 5th pillar portfolio_status → Parked");
    } else {
      console.log("5th pillar already exists with portfolio_status, skipping");
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
