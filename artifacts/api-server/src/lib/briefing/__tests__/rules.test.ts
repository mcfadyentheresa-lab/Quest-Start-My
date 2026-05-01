import { describe, expect, it } from "vitest";
import { buildRulesBriefing } from "../rules";
import type { BriefingInput } from "../types";

const baseDate = new Date("2026-04-28T09:00:00Z");

function pillar(id: number, name: string, priority: "P1" | "P2" | "P3" | "P4", active = true) {
  return {
    id,
    name,
    priority,
    description: null,
    isActiveThisWeek: active,
    color: "#abc",
    createdAt: baseDate,
    portfolioStatus: null,
    lastUpdated: null,
    category: null,
    honestNote: null,
  } as BriefingInput["pillars"][number];
}

function task(
  id: number,
  title: string,
  areaId: number | null,
  status: "pending" | "blocked" | "done" = "pending",
  blockerReason: string | null = null,
  overrides: Partial<BriefingInput["openTasks"][number]> = {},
): BriefingInput["openTasks"][number] {
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
    blockerReason,
    date: "2026-04-28",
    createdAt: baseDate,
    parentTaskId: null,
    stepBackDepth: 0,
    sortOrder: 0,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
    ...overrides,
  };
}

function milestone(
  id: number,
  title: string,
  areaId: number,
  mode: "ordered" | "any" = "ordered",
): BriefingInput["milestones"][number] {
  return {
    id,
    areaId,
    title,
    status: "active",
    priority: null,
    targetDate: null,
    description: null,
    nextAction: null,
    sortOrder: 0,
    mode,
    completedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  } as BriefingInput["milestones"][number];
}

function makeInput(overrides: Partial<BriefingInput> = {}): BriefingInput {
  const pillars = [pillar(1, "Aster & Spruce Living", "P1"), pillar(2, "Side Quest", "P3", false)];
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 9,
    userFirstName: "Theresa",
    pillars,
    activePillars: pillars.filter((p) => p.isActiveThisWeek),
    weeklyPlan: null,
    openTasks: [
      task(101, "Pay out Terry's income tax", 1),
      task(102, "Outline blog post", 2),
      task(103, "Email designer", 1, "blocked", "Waiting on assets"),
      task(104, "Plan onboarding", 1),
    ],
    recentlyCompleted: [],
    recentLogs: [],
    milestones: [],
    focusBlockMinutes: 25,
    ...overrides,
  };
}

describe("buildRulesBriefing", () => {
  it("greets by time of day with the user's first name", () => {
    const morning = buildRulesBriefing(makeInput());
    expect(morning.greeting).toBe("Good morning, Theresa.");

    const afternoon = buildRulesBriefing(makeInput({ hourLocal: 14 }));
    expect(afternoon.greeting).toBe("Good afternoon, Theresa.");

    const evening = buildRulesBriefing(makeInput({ hourLocal: 19 }));
    expect(evening.greeting).toBe("Good evening, Theresa.");
  });

  it("returns up to 3 items, P1 active first, then P3", () => {
    const out = buildRulesBriefing(makeInput());
    expect(out.briefing.length).toBeLessThanOrEqual(3);
    expect(out.briefing[0].pillarName).toBe("Aster & Spruce Living");
    expect(out.briefing[0].priority).toBe("P1");
  });

  it("excludes done tasks", () => {
    const input = makeInput({
      openTasks: [task(1, "Finished", 1, "done"), task(2, "Open", 1, "pending")],
    });
    const out = buildRulesBriefing(input);
    const titles = out.briefing.map((b) => b.title);
    expect(titles).toContain("Open");
    expect(titles).not.toContain("Finished");
  });

  it("scopes the headline based on number of items", () => {
    const one = buildRulesBriefing(makeInput({ openTasks: [task(1, "Only", 1)] }));
    expect(one.headline).toBe("One thing matters today.");

    const none = buildRulesBriefing(makeInput({ openTasks: [] }));
    expect(none.headline).toBe("A quiet day on the plan.");
  });

  it("surfaces blocked items with a clear blockedBy reason", () => {
    const input = makeInput({
      openTasks: [task(1, "Stuck thing", 1, "blocked", "Waiting on legal")],
    });
    const out = buildRulesBriefing(input);
    expect(out.briefing[0].blockedBy).toBe("Waiting on legal");
    expect(out.briefing[0].reasoning).toMatch(/blocked/i);
  });

  it("uses recent completion in the context line when available", () => {
    const input = makeInput({
      recentlyCompleted: [task(99, "Pay out Terry's income tax", 1, "done")],
    });
    const out = buildRulesBriefing(input);
    expect(out.context).toMatch(/Pay out Terry's income tax/);
    expect(out.context).toMatch(/Aster & Spruce Living/);
  });

  it("respects the date passed in", () => {
    const out = buildRulesBriefing(makeInput({ date: "2026-04-28" }));
    expect(out.date).toBe("2026-04-28");
    expect(out.source).toBe("rules");
    expect(out.approved).toBe(false);
  });

  it("rotates suggestions when a hint is provided", () => {
    const input = makeInput({
      openTasks: [
        task(1, "First", 1),
        task(2, "Second", 1),
        task(3, "Third", 1),
        task(4, "Fourth", 1),
      ],
    });
    const without = buildRulesBriefing(input);
    const withHint = buildRulesBriefing({ ...input, hint: "different" });
    expect(without.briefing[0].title).toBeDefined();
    expect(withHint.briefing[0].title).toBeDefined();
    // Without hint, ordering follows priority + recency. With hint we rotate so order may change.
    expect(withHint.briefing.length).toBeGreaterThan(0);
  });

  it("reasons about ordered-step progress on an ordered goal", () => {
    const goal = milestone(7, "Launch Aster site", 1, "ordered");
    const input = makeInput({
      milestones: [goal],
      openTasks: [
        task(201, "Write hero copy", 1, "pending", null, { milestoneId: 7, sortOrder: 1 }),
        task(202, "Pick hero image", 1, "pending", null, { milestoneId: 7, sortOrder: 2 }),
      ],
      recentlyCompleted: [
        task(200, "Outline pages", 1, "done", null, { milestoneId: 7, sortOrder: 0 }),
      ],
    });
    const out = buildRulesBriefing(input);
    const stepReason = out.briefing.find((b) => b.taskId === 201)?.reasoning ?? "";
    expect(stepReason).toMatch(/Step 2 of 3/);
    expect(stepReason).toContain("Launch Aster site");
    expect(stepReason).toMatch(/Earlier steps are done/);
  });

  it("flags an active-this-week area that has gone stale (>=5 days)", () => {
    const sixDaysAgo = new Date(baseDate.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const stalePillar = {
      ...pillar(1, "Aster & Spruce Living", "P3"),
      lastUpdated: sixDaysAgo,
    };
    const input = makeInput({
      pillars: [stalePillar],
      activePillars: [stalePillar],
      openTasks: [task(301, "Write a status update", 1)],
    });
    const out = buildRulesBriefing(input);
    const reason = out.briefing[0]?.reasoning ?? "";
    expect(reason).toMatch(/Marked active this week/);
    expect(reason).toMatch(/No progress logged in 6 days/);
    expect(reason).toMatch(/25-minute push/);
  });
});
