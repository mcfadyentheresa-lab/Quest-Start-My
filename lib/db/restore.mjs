import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Full pillar data reconstructed from user's memory (2026-04-23 restore session)
const PILLARS = [
  {
    name: "Aster & Spruce Living",
    priority: "P1",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#10b981",
    description: "Community and business connection platform",
    current_stage:
      "Right now this pillar is in a shaping stage where you are defining the business growth path, clarifying the offer, and identifying which assets and systems will make ASL more visible, premium, and scalable.",
    why_it_matters:
      "It matters because ASL needs a clearer growth path, not just more tasks. For remodeling businesses, better positioning, stronger referrals, and a standout customer experience can create higher-quality leads and stronger word-of-mouth than trying to market everywhere at once.",
    now_focus:
      "Clarify who ASL is for and what kind of projects you most want to be known for, because premium growth starts with a tighter client fit and offer definition. Finish or refine the website and portfolio presentation so ASL looks as premium and organized as you want it to feel. Capture or organize testimonials, before-and-afters, and project stories that prove quality and experience. Define the client experience standard, including how inquiries, updates, and project communication should feel from start to finish. Keep developing the project portal/app as a differentiator, but position it as part of a stronger overall client experience rather than the only growth plan.",
    next_focus:
      "Build a simple referral system for past clients, trade partners, and aligned professionals instead of relying on luck. Develop partnership relationships with interior designers, architects, real estate agents, suppliers, and trusted trades. Shape one or two signature offers or packages that make ASL easier to understand and recommend. Strengthen the digital trust layer with polished project pages, social proof, and clearer messaging around quality, style, and client care.",
    later_focus:
      "Turn ASL into a more recognized premium renovation brand with a distinct process, stronger referral flywheel, and better-fit clients arriving more consistently. Expand the Aster & Spruce Connect ecosystem so the business feels increasingly differentiated through digital tools, communication systems, and client-facing polish. Pursue higher-value opportunities, stronger collaborations, and a more selective pipeline once the positioning and systems are stable.",
    milestones: [
      { title: "Ideal Client Defined", status: "planned", priority: "P1", next_action: "Write a rough first draft of the ideal client and top project types." },
      { title: "Offer Clarified", status: "planned", priority: "P1", next_action: "Draft a one-paragraph offer statement for ASL." },
      { title: "Website Trust Layer Completed", status: "planned", priority: "P1", next_action: "List the pages or sections that need updating first." },
      { title: "Testimonials and Project Stories Organized", status: "planned", priority: "P2", next_action: "Gather existing testimonials, photos, and project notes into one folder or doc." },
      { title: "Signature Client Experience Mapped", status: "planned", priority: "P1", next_action: "Sketch the stages of the client journey from first inquiry to finish." },
      { title: "Referral System Created", status: "planned", priority: "P2", next_action: "Write down how referrals currently happen and where the gaps are." },
      { title: "Strategic Partner List Built", status: "planned", priority: "P2", next_action: "Make an initial list of possible partners." },
      { title: "Portal App Positioned as Differentiator", status: "planned", priority: "P2", next_action: "Write a short explanation of how the portal improves the client experience." },
      { title: "Better-Fit Lead Source Validated", status: "planned", priority: "P2", next_action: "Review recent leads and note where each one came from." },
      { title: "First Ideal-Fit Project Booked", status: "planned", priority: "P2", next_action: "Define what counts as an ideal-fit project." },
      { title: "Test milestone A", status: "planned", priority: null, next_action: null },
      { title: "Test milestone B", status: "planned", priority: null, next_action: null },
    ],
  },
  {
    name: "Quest Workday",
    priority: "P1",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#3b82f6",
    description: "Daily productivity and focus system",
    current_stage: null,
    why_it_matters:
      "It matters because I need a way to execute consistently without being overwhelmed by the big picture.",
    now_focus: "Right now I am building and refining the early versions while using them in real life.",
    next_focus: "In the next 4-6 weeks, the focus is getting the daily and weekly layers working smoothly for me.",
    later_focus:
      "After that, I probably want to refine milestones, guidance, and outcome views. Later: Eventually, I'd love this to be a digital product I could sell to others like me.",
    milestones: [],
  },
  {
    name: "AI Assistant Helper (ASL Project Partner APP)",
    priority: "P2",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#8b5cf6",
    description: "Personal AI tools and workflow automation",
    current_stage: "Right now I am defining the MVP and shaping the core portal experience for real client use.",
    why_it_matters:
      "This pillar is about building a client-facing project portal where renovation clients can log in and see their project through a personalized dashboard.",
    now_focus:
      "In the next 4-6 weeks, the focus is deciding what clients should see first — such as project progress, schedule, photos, documents, approvals, and key updates — and making sure the experience feels simple and branded.",
    next_focus: "After that, I probably want to prototype the client dashboard, project timeline, document area, and approval flow.",
    later_focus:
      "Eventually, I'd love this to become a polished Aster & Spruce Living portal that makes projects feel more transparent, organized, and premium for clients.",
    milestones: [],
  },
  {
    name: "Social Media",
    priority: "P2",
    portfolio_status: "Active",
    is_active_this_week: true,
    color: "#ec4899",
    description: "Social media presence and content",
    current_stage: null,
    why_it_matters: null,
    now_focus: null,
    next_focus: null,
    later_focus: null,
    milestones: [
      { title: "Drop 10 photos into Drive", status: "planned", priority: null, next_action: null },
      { title: "Voice note 3 of them", status: "planned", priority: null, next_action: null },
      { title: "Review captions from Computer", status: "planned", priority: null, next_action: null },
      { title: "Approve and schedule posts", status: "planned", priority: null, next_action: null },
    ],
  },
  {
    name: "Circadian App",
    priority: "P2",
    portfolio_status: "Warm",
    is_active_this_week: false,
    color: "#f59e0b",
    description: "Sleep and rhythm tracking application",
    current_stage: "Right now I am in an exploration and concept stage.",
    why_it_matters: "It matters because my own energy and sleep deeply affect my ability to run everything else.",
    now_focus: "In the next 4-6 weeks, the focus is just keeping the idea parked and capturing insights, not actively building.",
    next_focus: "After that, I might define a clear MVP if it still feels aligned.",
    later_focus: "Eventually, I'd love it to be a simple, supportive subscription product.",
    milestones: [],
  },
  {
    name: "Books / Digital Products",
    priority: "P3",
    portfolio_status: "Warm",
    is_active_this_week: false,
    color: "#a78bfa",
    description: "Written and digital product creation",
    current_stage:
      "Right now I am mainly collecting ideas, themes, and rough outlines, not actively building or launching.",
    why_it_matters:
      "It matters because writing and creating is a big part of who I am, and these projects could eventually support ASL, Quest, and my audience with deeper teaching and structured tools.",
    now_focus:
      "In the next 4-6 weeks, the focus is simply keeping a clean parking lot: one place where book ideas, prompts, and product concepts live, without turning them into active obligations.",
    next_focus:
      "After that, I might choose one lightweight product (like a planner, template, or small guide) to shape more clearly when I have the capacity and Quest/ASL are more stable.",
    later_focus:
      "Eventually, I'd love this pillar to become a small catalogue of books and digital products that feel aligned with how I actually live and work, and that support the other pillars instead of competing with them.",
    milestones: [
      { title: "First Product Idea Chosen", status: "planned", priority: "P2", next_action: "Write down the top three ideas and choose the simplest one to start with." },
      { title: "Product Direction Validated", status: "planned", priority: "P2", next_action: "Write why this product matters, who it is for, and why it should be first." },
      { title: "Product Outline Completed", status: "planned", priority: "P2", next_action: "Draft a rough outline of the main sections or pages." },
      { title: "First Draft Finished", status: "planned", priority: "P3", next_action: "Decide what format the first draft will be created in." },
      { title: "Product Design and Packaging Defined", status: "planned", priority: "P3", next_action: "Decide what the product should look and feel like visually." },
      { title: "Sales and Delivery Path Chosen", status: "planned", priority: "P3", next_action: "List the platforms or methods you could realistically use first." },
      { title: "Pricing and Offer Defined", status: "planned", priority: "P3", next_action: "Write a rough price range and what is included." },
      { title: "Product Page or Sales Page Ready", status: "planned", priority: "P3", next_action: "Draft a simple product description and promise." },
      { title: "First Downloadable Ready for Delivery", status: "planned", priority: "P3", next_action: "Decide the final file format you want to sell." },
      { title: "First Product Published", status: "planned", priority: "P2", next_action: "Decide what 'published' means for this first product." },
      { title: "First Sale or First Real Download Achieved", status: "planned", priority: "P3", next_action: "Decide how you will track the first sale or download." },
      { title: "Simple Product System Established", status: "planned", priority: "P2", next_action: "Note the repeatable steps you want future products to follow." },
      { title: "Covert ADHD Content calendar into downloadable $", status: "planned", priority: "P2", next_action: "Create a full plan breakdown, then stop" },
    ],
  },
  {
    name: "Pescky Art",
    priority: "P3",
    portfolio_status: "Warm",
    is_active_this_week: false,
    color: "#f472b6",
    description: "Art practice and creative identity",
    current_stage: null,
    why_it_matters:
      "It matters because my art is a real part of who I am, and I do not want it to get buried under my other business and product work. A separate strategic pillar helps keep an important identity visible instead of letting it disappear behind louder priorities.",
    now_focus:
      "Complete the Pescky website so the work has a proper home beyond social media. Complete the current drawing(s) so the body of work keeps moving and stays visible. Create branded items so the Pescky identity feels more intentional and cohesive. Organize your strongest images, titles, artist bio, and visual presentation so everything feels consistent across Instagram and the website.",
    next_focus:
      "Define how people can experience and potentially buy the work online without needing you to be physically present. Decide what kind of selling path fits you best, such as inquiries, originals, select releases, or future prints. Refine the Pescky brand so the artwork, website, and branded items feel like one clear artistic world.",
    later_focus:
      "Build a quieter sales system where the artwork can be discovered and sold online with less pressure for in-person interaction. Pursue press opportunities, features, and exposure once the website and portfolio feel stronger. Let Pescky become a more established public artist identity with a polished body of work and selective opportunities that fit your energy.",
    milestones: [
      { title: "Pescky Website", status: "planned", priority: "P3", next_action: "Reaching this milestone means my website is complete enough to present my work professionally, reflect my style, and act as a real home for the Pescky art practice." },
      { title: "Core Body of Work Finished", status: "planned", priority: "P3", next_action: "Write down which current drawings need to be finished." },
      { title: "Portfolio Selection Curated", status: "planned", priority: "P3", next_action: "Select the top works you want to include first." },
      { title: "Artist Brand Foundations Defined", status: "planned", priority: "P3", next_action: "Write a rough artist statement and 3-5 words that describe the Pescky identity." },
      { title: "Branded Items Created", status: "planned", priority: "P3", next_action: "Decide which branded items matter most to create first." },
      { title: "Website Portfolio Ready for Sharing", status: "planned", priority: "P3", next_action: "Review the website from the perspective of a first-time visitor." },
      { title: "Online Sales Path Defined", status: "planned", priority: "P3", next_action: "Decide the simplest first sales model for Pescky." },
      { title: "First Online Purchase or Inquiry Path Live", status: "planned", priority: "P3", next_action: "Decide whether the first version is an inquiry form, direct email prompt, or simple shop setup." },
      { title: "Pescky Press Kit Prepared", status: "planned", priority: "P3", next_action: "Start a folder for bio, headshot or brand image, and high-quality artwork images." },
      { title: "First Press or Feature Outreach Ready", status: "planned", priority: "P3", next_action: "Make a shortlist of the kinds of outlets or opportunities that would feel aligned." },
      { title: "Low-Touch Art Sales System Working", status: "planned", priority: "P3", next_action: "Define what 'low-touch' means for you in practical terms." },
    ],
  },
];

async function restore() {
  const client = await pool.connect();
  try {
    console.log("=== Quest data restore ===\n");

    // Snapshot existing state
    const existingPillars = await client.query("SELECT id, name FROM pillars");
    const existingMilestones = await client.query("SELECT COUNT(*) FROM milestones");
    console.log(`Current state: ${existingPillars.rows.length} pillars, ${existingMilestones.rows[0].count} milestones`);
    if (existingPillars.rows.length > 0) {
      console.log("Existing pillar names:", existingPillars.rows.map((r) => r.name).join(", "));
    }
    console.log("");

    // GUARD: only run the one-time restore if the pillars table is empty.
    // This prevents overwriting any edits the user makes in the app on later
    // deploys. To force a re-run, set QUEST_FORCE_RESTORE=1.
    if (existingPillars.rows.length > 0 && process.env.QUEST_FORCE_RESTORE !== "1") {
      console.log("[restore] pillars already exist — skipping restore to preserve user edits.");
      console.log("[restore] To force a re-run (idempotent upsert), set QUEST_FORCE_RESTORE=1.");
      return;
    }

    let pillarsInserted = 0;
    let pillarsUpdated = 0;
    let milestonesInserted = 0;
    let milestonesSkipped = 0;

    for (const p of PILLARS) {
      // Upsert by name: if pillar exists, update it; otherwise insert
      const existing = await client.query("SELECT id FROM pillars WHERE name = $1", [p.name]);

      let pillarId;
      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO pillars
            (name, priority, description, is_active_this_week, color, portfolio_status,
             current_stage, why_it_matters, now_focus, next_focus, later_focus)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            p.name, p.priority, p.description, p.is_active_this_week, p.color, p.portfolio_status,
            p.current_stage, p.why_it_matters, p.now_focus, p.next_focus, p.later_focus,
          ]
        );
        pillarId = result.rows[0].id;
        pillarsInserted++;
        console.log(`✓ Inserted pillar: ${p.name} (id=${pillarId})`);
      } else {
        pillarId = existing.rows[0].id;
        await client.query(
          `UPDATE pillars SET
             priority = $2, description = $3, is_active_this_week = $4, color = $5,
             portfolio_status = $6, current_stage = $7, why_it_matters = $8,
             now_focus = $9, next_focus = $10, later_focus = $11
           WHERE id = $1`,
          [
            pillarId, p.priority, p.description, p.is_active_this_week, p.color,
            p.portfolio_status, p.current_stage, p.why_it_matters, p.now_focus,
            p.next_focus, p.later_focus,
          ]
        );
        pillarsUpdated++;
        console.log(`↻ Updated pillar: ${p.name} (id=${pillarId})`);
      }

      // Insert milestones (only if missing — match by pillar_id + title)
      for (let i = 0; i < p.milestones.length; i++) {
        const m = p.milestones[i];
        const existingM = await client.query(
          "SELECT id FROM milestones WHERE pillar_id = $1 AND title = $2",
          [pillarId, m.title]
        );
        if (existingM.rows.length > 0) {
          milestonesSkipped++;
          continue;
        }
        await client.query(
          `INSERT INTO milestones (pillar_id, title, status, priority, next_action, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pillarId, m.title, m.status, m.priority, m.next_action, i]
        );
        milestonesInserted++;
      }
      if (p.milestones.length > 0) {
        console.log(`   → ${p.milestones.length} milestones processed`);
      }
    }

    console.log("\n=== Summary ===");
    console.log(`Pillars inserted: ${pillarsInserted}`);
    console.log(`Pillars updated:  ${pillarsUpdated}`);
    console.log(`Milestones inserted: ${milestonesInserted}`);
    console.log(`Milestones skipped (already existed): ${milestonesSkipped}`);

    // Final verification
    const finalPillars = await client.query("SELECT COUNT(*) FROM pillars");
    const finalMilestones = await client.query("SELECT COUNT(*) FROM milestones");
    console.log(`\nFinal state: ${finalPillars.rows[0].count} pillars, ${finalMilestones.rows[0].count} milestones`);
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
