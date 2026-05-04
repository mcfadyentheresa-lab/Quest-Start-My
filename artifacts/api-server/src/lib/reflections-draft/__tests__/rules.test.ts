import { describe, expect, it } from "vitest";
import { buildRulesDraft, buildEmptyFallback } from "../rules";
import type { ReflectionDraftInput } from "../types";

const baseDate = new Date("2026-04-28T09:00:00Z");

function area(
  id: number,
  name: string,
  priority: "P1" | "P2" | "P3" | "P4",
  active = true,
  portfolioStatus: string | null = null,
) {
  return {
    id,
    name,
    priority,
    description: null,
    isActiveThisWeek: active,
    color: "#abc",
    createdAt: baseDate,
    portfolioStatus,
    nowFocus: null,
    lastUpdated: null,
    category: null,
    userId: "owner",
    honestNote: null,
  } as ReflectionDraftInput["areas"][number];
}

function task(
  id: number,
  title: string,
  areaId: number | null,
  status: "pending" | "blocked" | "done" = "pending",
  date = "2026-04-28",
  overrides: Partial<ReflectionDraftInput["openTasks"][number]> = {},
): ReflectionDraftInput["openTasks"][number] {
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
    date,
    createdAt: baseDate,
    parentTaskId: null,
    stepBackDepth: 0,
    userId: "owner",
    sortOrder: 0,
    recurringTaskId: null,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
    originalDump: null,
    needsReview: false,
    energy: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ReflectionDraftInput> = {}): ReflectionDraftInput {
  const areas = [area(1, "Aster & Spruce", "P1"), area(2, "Side Quest", "P3", false)];
  return {
    cadence: "week",
    periodStart: "2026-04-27",
    periodEnd: "2026-05-03",
    periodLabel: "this week",
    now: baseDate,
    areas,
    activeAreas: areas.filter((a) => a.isActiveThisWeek),
    completedTasks: [],
    openTasks: [],
    recentLogs: [],
    milestones: [],
    ...overrides,
  };
}

describe("buildRulesDraft", () => {
  it("groups completed tasks by area in 'moved'", () => {
    const out = buildRulesDraft(
      makeInput({
        completedTasks: [
          task(1, "Pay tax", 1, "done"),
          task(2, "Email designer", 1, "done"),
          task(3, "Write blog post", 2, "done"),
        ],
      }),
    );
    expect(out.moved).toContain("Aster & Spruce: 2 tasks closed");
    expect(out.moved).toContain("Side Quest: 1 task closed");
    expect(out.source).toBe("rules");
  });

  it("returns a clean-slate moved when nothing was completed", () => {
    const out = buildRulesDraft(makeInput());
    expect(out.moved).toMatch(/No tasks closed/i);
  });

  it("flags blocked + stale + active-but-quiet in 'stuck'", () => {
    const out = buildRulesDraft(
      makeInput({
        openTasks: [
          task(1, "Email vendor", 1, "blocked", "2026-04-28", { blockerReason: "Waiting on legal" }),
          task(2, "Draft RFP", 1, "pending", "2026-04-15"),
        ],
        completedTasks: [],
      }),
    );
    expect(out.stuck).toMatch(/Blocked/i);
    expect(out.stuck).toMatch(/Sitting too long/i);
    expect(out.stuck).toMatch(/Active but quiet/i);
  });

  it("suggests dropping active areas with no moves", () => {
    const out = buildRulesDraft(
      makeInput({
        activeAreas: [area(1, "Aster & Spruce", "P1"), area(3, "Idle Area", "P2", true)],
        areas: [area(1, "Aster & Spruce", "P1"), area(3, "Idle Area", "P2", true)],
        completedTasks: [task(1, "Pay tax", 1, "done")],
      }),
    );
    expect(out.drop).toMatch(/Idle Area/);
  });

  it("nextFocus names the top P1 active area", () => {
    const out = buildRulesDraft(makeInput());
    expect(out.nextFocus).toContain("Aster & Spruce");
    expect(out.nextFocus).toContain("P1");
  });

  it("nextFocus falls back when no active areas", () => {
    const out = buildRulesDraft(
      makeInput({
        activeAreas: [],
        areas: [area(1, "Aster & Spruce", "P1", false)],
      }),
    );
    expect(out.nextFocus).toMatch(/Pick one area/i);
  });

  it("returns generated timestamp matching now", () => {
    const out = buildRulesDraft(makeInput());
    expect(out.generatedAt).toBe(baseDate.toISOString());
  });
});

describe("buildEmptyFallback", () => {
  it("returns gentle fallback strings", () => {
    const out = buildEmptyFallback(makeInput());
    expect(out.moved).toMatch(/No moves this week/);
    expect(out.stuck).toBeTruthy();
    expect(out.drop).toBeTruthy();
    expect(out.nextFocus).toBeTruthy();
    expect(out.source).toBe("fallback");
  });

  it("uses month language when cadence is month", () => {
    const out = buildEmptyFallback(makeInput({ cadence: "month", periodLabel: "April 2026" }));
    expect(out.moved).toMatch(/April 2026/);
    expect(out.nextFocus).toMatch(/next month/i);
  });
});
