import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Demo fixtures used to seed an empty database with a starter set of areas
// and milestones. These are intentionally generic — they do not contain any
// personal user strategy. Real per-user strategy data lives in the database
// per `user_id` and is created by the user through the app.
//
// The OWNER_USER_ID picks which user these demo rows belong to. In single-
// owner deployments this is "owner" by default; multi-tenant deployments
// should not run this seed.
const OWNER_USER_ID = process.env.QUEST_OWNER_USER_ID || "owner";

const AREAS = [
  {
    name: "Demo Area: Business",
    priority: "P1",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#10b981",
    description: "Sample business-focused area to explore the app.",
    current_stage: "Sample current stage. Replace this with your own context once you sign in.",
    why_it_matters: "Sample reason this area matters. Edit it to make it yours.",
    now_focus: "Sample short-term focus for the next few weeks.",
    next_focus: "Sample medium-term focus for the next month or two.",
    later_focus: "Sample long-term direction for this area.",
    milestones: [
      { title: "Sample Milestone 1", status: "planned", priority: "P1", next_action: "Replace this with your own first action." },
      { title: "Sample Milestone 2", status: "planned", priority: "P2", next_action: "Replace this with your own next action." },
    ],
  },
  {
    name: "Demo Area: Personal Project",
    priority: "P2",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#3b82f6",
    description: "Sample side-project area.",
    current_stage: null,
    why_it_matters: "Sample reason this side project matters to you.",
    now_focus: "Sample focus for the next few weeks.",
    next_focus: "Sample next-quarter focus.",
    later_focus: "Sample long-term vision.",
    milestones: [
      { title: "Sample Milestone A", status: "planned", priority: "P2", next_action: "Replace with your own first action." },
    ],
  },
  {
    name: "Demo Area: Health & Energy",
    priority: "P2",
    portfolio_status: "Warm",
    is_active_this_week: false,
    color: "#f59e0b",
    description: "Sample health and energy area.",
    current_stage: null,
    why_it_matters: null,
    now_focus: null,
    next_focus: null,
    later_focus: null,
    milestones: [],
  },
];

async function restore() {
  const client = await pool.connect();
  try {
    console.log("=== Quest demo data restore ===\n");

    // Snapshot existing state
    const existingAreas = await client.query("SELECT id, name FROM areas");
    const existingMilestones = await client.query("SELECT COUNT(*) FROM milestones");
    console.log(`Current state: ${existingAreas.rows.length} areas, ${existingMilestones.rows[0].count} milestones`);
    if (existingAreas.rows.length > 0) {
      console.log("Existing area names:", existingAreas.rows.map((r) => r.name).join(", "));
    }
    console.log("");

    // GUARD: only run the one-time demo seed if the areas table is empty.
    // This prevents overwriting any edits the user makes in the app on later
    // deploys. To force a re-run, set QUEST_FORCE_RESTORE=1.
    if (existingAreas.rows.length > 0 && process.env.QUEST_FORCE_RESTORE !== "1") {
      console.log("[restore] areas already exist — skipping seed to preserve user edits.");
      console.log("[restore] To force a re-run (idempotent upsert), set QUEST_FORCE_RESTORE=1.");
      return;
    }

    let areasInserted = 0;
    let areasUpdated = 0;
    let milestonesInserted = 0;
    let milestonesSkipped = 0;

    for (const p of AREAS) {
      // Upsert by (user_id, name): if area exists for this user, update it; otherwise insert
      const existing = await client.query(
        "SELECT id FROM areas WHERE user_id = $1 AND name = $2",
        [OWNER_USER_ID, p.name]
      );

      let areaId;
      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO areas
            (user_id, name, priority, description, is_active_this_week, color, portfolio_status,
             current_stage, why_it_matters, now_focus, next_focus, later_focus)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id`,
          [
            OWNER_USER_ID, p.name, p.priority, p.description, p.is_active_this_week, p.color, p.portfolio_status,
            p.current_stage, p.why_it_matters, p.now_focus, p.next_focus, p.later_focus,
          ]
        );
        areaId = result.rows[0].id;
        areasInserted++;
        console.log(`✓ Inserted area: ${p.name} (id=${areaId})`);
      } else {
        areaId = existing.rows[0].id;
        await client.query(
          `UPDATE areas SET
             priority = $2, description = $3, is_active_this_week = $4, color = $5,
             portfolio_status = $6, current_stage = $7, why_it_matters = $8,
             now_focus = $9, next_focus = $10, later_focus = $11
           WHERE id = $1`,
          [
            areaId, p.priority, p.description, p.is_active_this_week, p.color,
            p.portfolio_status, p.current_stage, p.why_it_matters, p.now_focus,
            p.next_focus, p.later_focus,
          ]
        );
        areasUpdated++;
        console.log(`↻ Updated area: ${p.name} (id=${areaId})`);
      }

      // Insert milestones (only if missing — match by area_id + title)
      for (let i = 0; i < p.milestones.length; i++) {
        const m = p.milestones[i];
        const existingM = await client.query(
          "SELECT id FROM milestones WHERE user_id = $1 AND area_id = $2 AND title = $3",
          [OWNER_USER_ID, areaId, m.title]
        );
        if (existingM.rows.length > 0) {
          milestonesSkipped++;
          continue;
        }
        await client.query(
          `INSERT INTO milestones (user_id, area_id, title, status, priority, next_action, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [OWNER_USER_ID, areaId, m.title, m.status, m.priority, m.next_action, i]
        );
        milestonesInserted++;
      }
      if (p.milestones.length > 0) {
        console.log(`   → ${p.milestones.length} milestones processed`);
      }
    }

    console.log("\n=== Summary ===");
    console.log(`Areas inserted: ${areasInserted}`);
    console.log(`Areas updated:  ${areasUpdated}`);
    console.log(`Milestones inserted: ${milestonesInserted}`);
    console.log(`Milestones skipped (already existed): ${milestonesSkipped}`);

    // Final verification
    const finalAreas = await client.query("SELECT COUNT(*) FROM areas");
    const finalMilestones = await client.query("SELECT COUNT(*) FROM milestones");
    console.log(`\nFinal state: ${finalAreas.rows[0].count} areas, ${finalMilestones.rows[0].count} milestones`);
  } finally {
    client.release();
    await pool.end();
  }
}

restore()
  .then(() => {
    console.log("[restore] done, exiting cleanly");
    process.exit(0);
  })
  .catch((err) => {
    // Fail-soft: log the error but exit 0 so the deploy still starts the app.
    // The restore is idempotent; if a transient failure happens, it will retry
    // on the next deploy without causing duplicates.
    console.error("[restore] failed (non-fatal, app will still start):", err);
    process.exit(0);
  });
