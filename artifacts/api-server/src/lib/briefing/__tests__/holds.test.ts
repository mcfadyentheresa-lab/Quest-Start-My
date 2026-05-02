import { describe, expect, it } from "vitest";
import { computeHeldMilestoneIds, excludeHeldTasks } from "../holds";
import type { Milestone, Task } from "@workspace/db";

const baseDate = new Date("2026-04-28T09:00:00Z");

function milestone(over: Partial<Milestone>): Milestone {
  return {
    id: 0,
    areaId: 1,
    title: "",
    status: "active",
    priority: null,
    targetDate: null,
    description: null,
    nextAction: null,
    sortOrder: 0,
    mode: "ordered",
    holdUntilMilestoneId: null,
    completedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...over,
  } as Milestone;
}

function task(over: Partial<Task>): Task {
  return {
    id: 0,
    title: "",
    category: "business",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status: "pending",
    areaId: 1,
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
    ...over,
  } as Task;
}

describe("computeHeldMilestoneIds", () => {
  it("flags a milestone as held when its prereq is incomplete", () => {
    const ms = [
      milestone({ id: 1, title: "Phase 1" }),
      milestone({ id: 2, title: "Phase 2", holdUntilMilestoneId: 1 }),
    ];
    const held = computeHeldMilestoneIds(ms);
    expect(held.has(2)).toBe(true);
    expect(held.has(1)).toBe(false);
  });

  it("does not flag when the prereq is complete", () => {
    const ms = [
      milestone({ id: 1, title: "Phase 1", completedAt: baseDate }),
      milestone({ id: 2, title: "Phase 2", holdUntilMilestoneId: 1 }),
    ];
    const held = computeHeldMilestoneIds(ms);
    expect(held.size).toBe(0);
  });

  it("returns an empty set when no holds exist", () => {
    const ms = [milestone({ id: 1 }), milestone({ id: 2 })];
    expect(computeHeldMilestoneIds(ms).size).toBe(0);
  });
});

describe("excludeHeldTasks", () => {
  it("drops tasks whose milestone is held, keeps unrelated tasks", () => {
    const ms = [
      milestone({ id: 1 }),
      milestone({ id: 2, holdUntilMilestoneId: 1 }),
    ];
    const tasks = [
      task({ id: 10, milestoneId: 1, title: "live phase 1 step" }),
      task({ id: 11, milestoneId: 2, title: "held phase 2 step" }),
      task({ id: 12, milestoneId: null, title: "loose task" }),
    ];
    const filtered = excludeHeldTasks(tasks, ms);
    const ids = filtered.map((t) => t.id).sort();
    expect(ids).toEqual([10, 12]);
  });

  it("re-includes tasks once the prereq is complete", () => {
    const ms = [
      milestone({ id: 1, completedAt: baseDate }),
      milestone({ id: 2, holdUntilMilestoneId: 1 }),
    ];
    const tasks = [task({ id: 11, milestoneId: 2, title: "phase 2 step" })];
    const filtered = excludeHeldTasks(tasks, ms);
    expect(filtered).toHaveLength(1);
  });
});
