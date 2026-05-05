import { describe, expect, it } from "vitest";
import { enrichBriefingWithGoals } from "../enrich";
import type { BriefingInput, BriefingItem, BriefingResponse } from "../types";

const baseDate = new Date("2026-04-28T09:00:00Z");

function task(
  id: number,
  milestoneId: number | null,
): BriefingInput["openTasks"][number] {
  return {
    id,
    title: `Task ${id}`,
    category: "business",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status: "pending",
    areaId: 1,
    milestoneId,
    blockerReason: null,
    date: "2026-04-28",
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
  };
}

function milestone(id: number, title: string): BriefingInput["milestones"][number] {
  return {
    id,
    areaId: 1,
    title,
    status: "active",
    priority: null,
    targetDate: null,
    description: null,
    nextAction: null,
    holdUntilMilestoneId: null,
    userId: "owner",
    sortOrder: 0,
    mode: "ordered",
    completedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

function item(taskId: number | null): BriefingItem {
  return {
    taskId,
    title: `Item ${taskId}`,
    pillarName: "Pillar",
    pillarColor: null,
    priority: "P3",
    reasoning: "test",
    estimatedMinutes: 25,
    suggestedNextStep: null,
    blockedBy: null,
    goalId: null,
    goalTitle: null,
  };
}

function makeInput(overrides: Partial<BriefingInput> = {}): BriefingInput {
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 9,
    userFirstName: "Theresa",
    pillars: [],
    activePillars: [],
    weeklyPlan: null,
    openTasks: [],
    recentlyCompleted: [],
    recentLogs: [],
    milestones: [],
    focusBlockMinutes: 25,
    ...overrides,
  };
}

function makeBriefing(items: BriefingItem[]): BriefingResponse {
  return {
    greeting: "hi",
    headline: "head",
    context: "ctx",
    briefing: items,
    signoff: "bye",
    date: "2026-04-28",
    source: "rules",
    approved: false,
    generatedAt: baseDate.toISOString(),
  };
}

describe("enrichBriefingWithGoals", () => {
  it("populates goalId and goalTitle from the task's milestone", () => {
    const input = makeInput({
      openTasks: [task(101, 7)],
      milestones: [milestone(7, "Ship the ASL site")],
    });
    const out = enrichBriefingWithGoals(makeBriefing([item(101)]), input);
    expect(out.briefing[0].goalId).toBe(7);
    expect(out.briefing[0].goalTitle).toBe("Ship the ASL site");
  });

  it("leaves goalId and goalTitle null when the task has no milestone", () => {
    const input = makeInput({
      openTasks: [task(101, null)],
      milestones: [milestone(7, "Ship the ASL site")],
    });
    const out = enrichBriefingWithGoals(makeBriefing([item(101)]), input);
    expect(out.briefing[0].goalId).toBeNull();
    expect(out.briefing[0].goalTitle).toBeNull();
  });

  it("leaves goalId and goalTitle null for items without a numeric taskId", () => {
    const input = makeInput({
      openTasks: [task(101, 7)],
      milestones: [milestone(7, "Ship the ASL site")],
    });
    const out = enrichBriefingWithGoals(makeBriefing([item(null)]), input);
    expect(out.briefing[0].goalId).toBeNull();
    expect(out.briefing[0].goalTitle).toBeNull();
  });
});
