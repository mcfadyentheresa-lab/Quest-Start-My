import { describe, expect, it } from "vitest";

// db reads DATABASE_URL eagerly at import time; the export route imports db.
process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";

const { buildExportCsv, exportFilename, EXPORT_CSV_HEADER } = await import("../export");

type PillarRow = {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  portfolioStatus: string | null;
  currentStage: string | null;
  whyItMatters: string | null;
  nowFocus: string | null;
  nextFocus: string | null;
  laterFocus: string | null;
  blockers: string | null;
  lastUpdated: string | null;
  featureTag: string | null;
  category: string | null;
};

type MilestoneRow = {
  id: number;
  userId: string;
  pillarId: number;
  title: string;
  status: string;
  priority: string | null;
  targetDate: string | null;
  description: string | null;
  nextAction: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type TaskRow = {
  id: number;
  userId: string;
  title: string;
  category: string;
  whyItMatters: string | null;
  doneLooksLike: string | null;
  suggestedNextStep: string | null;
  status: string;
  pillarId: number | null;
  milestoneId: number | null;
  blockerReason: string | null;
  date: string;
  createdAt: Date;
  parentTaskId: number | null;
  stepBackDepth: number;
  blockerType: string | null;
  adjustmentType: string | null;
  adjustmentReason: string | null;
  taskSource: string | null;
};

function makePillar(over: Partial<PillarRow>): PillarRow {
  return {
    id: 1,
    userId: "owner",
    name: "Health",
    description: null,
    color: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    portfolioStatus: "Active",
    currentStage: null,
    whyItMatters: null,
    nowFocus: null,
    nextFocus: null,
    laterFocus: null,
    blockers: null,
    lastUpdated: null,
    featureTag: null,
    category: null,
    ...over,
  };
}

function makeMilestone(over: Partial<MilestoneRow>): MilestoneRow {
  return {
    id: 1,
    userId: "owner",
    pillarId: 1,
    title: "Run a 5K",
    status: "planned",
    priority: null,
    targetDate: "2026-06-01",
    description: null,
    nextAction: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    ...over,
  };
}

function makeTask(over: Partial<TaskRow>): TaskRow {
  return {
    id: 1,
    userId: "owner",
    title: "Lace shoes",
    category: "personal",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status: "pending",
    pillarId: 1,
    milestoneId: 1,
    blockerReason: null,
    date: "2026-04-27",
    createdAt: new Date("2026-04-27T00:00:00Z"),
    parentTaskId: null,
    stepBackDepth: 0,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
    ...over,
  };
}

describe("Phase 6: CSV export shaping", () => {
  it("emits a header row with the documented columns", () => {
    const csv = buildExportCsv([], [], []);
    expect(csv.split("\n")[0]).toBe(EXPORT_CSV_HEADER);
    expect(EXPORT_CSV_HEADER).toContain("kind,id,title");
    expect(EXPORT_CSV_HEADER).toContain("pillarName");
    expect(EXPORT_CSV_HEADER).toContain("milestoneTitle");
  });

  it("denormalizes pillar/milestone titles onto each task row", () => {
    const pillars = [makePillar({ id: 7, name: "Health" })];
    const milestones = [makeMilestone({ id: 11, pillarId: 7, title: "Run a 5K" })];
    const tasks = [makeTask({ pillarId: 7, milestoneId: 11, title: "Lace shoes" })];

    const csv = buildExportCsv(pillars, milestones, tasks);
    const lines = csv.trim().split("\n");
    const taskLine = lines[lines.length - 1]!;

    expect(taskLine.startsWith("task,")).toBe(true);
    expect(taskLine).toContain("Health");
    expect(taskLine).toContain("Run a 5K");
    expect(taskLine).toContain("Lace shoes");
  });

  it("escapes commas, quotes, and newlines in CSV cells", () => {
    const pillars = [
      makePillar({
        id: 1,
        name: 'Mind, "Body" & Soul',
        description: "line1\nline2",
      }),
    ];
    const csv = buildExportCsv(pillars, [], []);
    // Quoted name with escaped inner quotes
    expect(csv).toContain('"Mind, ""Body"" & Soul"');
    // Quoted description preserves the embedded newline
    expect(csv).toContain('"line1\nline2"');
  });

  it("emits a row for every pillar, milestone, and task (one section each)", () => {
    const pillars = [makePillar({ id: 1 }), makePillar({ id: 2, name: "Work" })];
    const milestones = [makeMilestone({ id: 1 })];
    const tasks = [
      makeTask({ id: 1 }),
      makeTask({ id: 2, title: "Run", pillarId: null, milestoneId: null }),
    ];
    const csv = buildExportCsv(pillars, milestones, tasks);
    const lines = csv.trim().split("\n");
    // 1 header + 2 pillars + 1 milestone + 2 tasks = 6
    expect(lines.length).toBe(6);
    expect(lines.filter((l) => l.startsWith("pillar,")).length).toBe(2);
    expect(lines.filter((l) => l.startsWith("milestone,")).length).toBe(1);
    expect(lines.filter((l) => l.startsWith("task,")).length).toBe(2);
  });

  it("filename uses the user's local date", () => {
    expect(exportFilename("2026-04-27")).toBe("quest-export-2026-04-27.csv");
  });
});

describe("Phase 6: export route is auth-gated", () => {
  it("is registered behind the requireAuth middleware (mounted after it in routes/index.ts)", async () => {
    // The router exports the relative path /export.csv. Auth gating is enforced
    // by the parent router mounting `requireAuth` before this router is mounted
    // (see src/routes/index.ts). This test pins that wiring as a regression
    // guard — if a future refactor moves the export route above requireAuth,
    // the import below still works but the parent wiring will visibly diverge.
    const indexSrc = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../index.ts", import.meta.url), "utf8"),
    );
    const requireAuthIdx = indexSrc.indexOf("router.use(requireAuth)");
    const exportRouterIdx = indexSrc.indexOf("router.use(exportRouter)");
    expect(requireAuthIdx).toBeGreaterThan(-1);
    expect(exportRouterIdx).toBeGreaterThan(-1);
    expect(exportRouterIdx).toBeGreaterThan(requireAuthIdx);
  });
});
