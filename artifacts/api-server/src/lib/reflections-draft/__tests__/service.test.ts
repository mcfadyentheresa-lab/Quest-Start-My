import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The service module imports @workspace/db at module load (it pulls in the
// shared `db` handle). We don't exercise the db path in this test (we pass
// `input` directly), so stub the module surface.
vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => Promise.resolve([]), limit: () => Promise.resolve([]) }),
        orderBy: () => Promise.resolve([]),
        limit: () => Promise.resolve([]),
      }),
    }),
  },
  tasksTable: {},
  areasTable: { id: Symbol("areas.id") },
  milestonesTable: {},
  weeklyPlansTable: {},
  progressLogsTable: {},
  monthlyReviewsTable: {},
  dailyBriefingsTable: {},
}));

import { generateReflectionDraft } from "../service";
import { clearReflectionDraftCache } from "../cache";
import type { ReflectionDraftInput } from "../types";

const baseDate = new Date("2026-04-28T09:00:00Z");

function area(id: number, name: string, priority: "P1" | "P2" | "P3" | "P4", active = true) {
  return {
    id,
    name,
    priority,
    description: null,
    isActiveThisWeek: active,
    color: "#abc",
    createdAt: baseDate,
    portfolioStatus: null,
    currentStage: null,
    whyItMatters: null,
    nowFocus: null,
    nextFocus: null,
    laterFocus: null,
    blockers: null,
    lastUpdated: null,
    featureTag: null,
    category: null,
    honestNote: null,
  } as ReflectionDraftInput["areas"][number];
}

function task(id: number, title: string, areaId: number, status: "pending" | "blocked" | "done" = "done") {
  return {
    id,
    title,
    category: "business",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status,
    areaId,
    milestoneId: null,
    blockerReason: null,
    date: "2026-04-28",
    createdAt: baseDate,
    parentTaskId: null,
    stepBackDepth: 0,
    sortOrder: 0,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
  } as ReflectionDraftInput["openTasks"][number];
}

function makeInput(overrides: Partial<ReflectionDraftInput> = {}): ReflectionDraftInput {
  const areas = [area(1, "Aster & Spruce", "P1")];
  return {
    cadence: "week",
    periodStart: "2026-04-27",
    periodEnd: "2026-05-03",
    periodLabel: "this week",
    now: baseDate,
    areas,
    activeAreas: areas.filter((a) => a.isActiveThisWeek),
    completedTasks: [task(1, "Pay tax", 1, "done")],
    openTasks: [],
    recentLogs: [],
    milestones: [],
    ...overrides,
  };
}

describe("generateReflectionDraft", () => {
  const originalKey = process.env["OPENAI_API_KEY"];

  beforeEach(() => {
    clearReflectionDraftCache();
    delete process.env["OPENAI_API_KEY"];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env["OPENAI_API_KEY"];
    else process.env["OPENAI_API_KEY"] = originalKey;
    clearReflectionDraftCache();
  });

  it("returns a non-empty rules draft when there is data and no AI key", async () => {
    const draft = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput(),
    });
    expect(draft.source).toBe("rules");
    expect(draft.moved).toMatch(/Aster & Spruce/);
    expect(draft.nextFocus).toBeTruthy();
  });

  it("returns empty-fallback strings when there is no data", async () => {
    const draft = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput({
        completedTasks: [],
        openTasks: [],
        activeAreas: [],
        areas: [],
      }),
    });
    expect(draft.source).toBe("fallback");
    expect(draft.moved).toMatch(/No moves this week/i);
    expect(draft.nextFocus).toMatch(/Pick one area/i);
  });

  it("caches the second call within 60 minutes", async () => {
    const first = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput(),
      now: baseDate,
    });
    // Second call provides a different input — if the cache works, the
    // returned draft is the original.
    const within = new Date(baseDate.getTime() + 30 * 60 * 1000);
    const second = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput({
        completedTasks: [task(99, "Totally different task", 1, "done")],
      }),
      now: within,
    });
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.moved).toBe(first.moved);
  });

  it("regenerates when bypassCache is true", async () => {
    const first = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput(),
      now: new Date(baseDate.getTime()),
    });
    const later = new Date(baseDate.getTime() + 60_000);
    const second = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput({ now: later }),
      bypassCache: true,
      now: later,
    });
    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it("scopes the cache by cadence and period", async () => {
    const week = await generateReflectionDraft({
      cadence: "week",
      periodKey: "2026-04-27",
      input: makeInput(),
    });
    const month = await generateReflectionDraft({
      cadence: "month",
      periodKey: "2026-04",
      input: makeInput({
        cadence: "month",
        periodLabel: "April 2026",
        completedTasks: [task(1, "Different month task", 1, "done")],
      }),
    });
    expect(month.moved).not.toBe(week.moved);
  });
});
