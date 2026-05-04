import { describe, expect, it } from "vitest";
import {
  buildRulesRecap,
  computeAreaBreakdown,
  pickReflectionPrompt,
  REFLECTION_PROMPTS,
} from "../rules";
import type { RecapInput } from "../types";

const baseDate = new Date("2026-04-28T22:00:00Z");

function pillar(id: number, name: string, color = "#abc"): RecapInput["pillars"][number] {
  return {
    id,
    name,
    priority: "P1",
    description: null,
    isActiveThisWeek: true,
    color,
    createdAt: baseDate,
    portfolioStatus: null,
    nowFocus: null,
    lastUpdated: null,
    category: null,
    userId: "owner",
    honestNote: null,
  };
}

function task(
  id: number,
  title: string,
  areaId: number | null,
  status: "pending" | "blocked" | "done" = "done",
): RecapInput["closedToday"][number] {
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
    userId: "owner",
    sortOrder: 0,
    recurringTaskId: null,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
  };
}

function makeInput(overrides: Partial<RecapInput> = {}): RecapInput {
  const pillars = [pillar(1, "Operations"), pillar(2, "Side Quest", "#def")];
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 18,
    userFirstName: "Theresa",
    pillars,
    closedToday: [
      task(1, "Pay out income tax", 1),
      task(2, "Reply to designer", 1),
      task(3, "Outline blog post", 2),
    ],
    openToday: [task(4, "Schedule call", 1, "pending"), task(5, "Email vendor", 1, "blocked")],
    reflectionPromptIndex: 0,
    ...overrides,
  };
}

describe("buildRulesRecap", () => {
  it("returns the full recap shape with greeting, headline, lists, breakdown, prompt, and signoff", () => {
    const recap = buildRulesRecap(makeInput());
    expect(recap.greeting).toBe("Evening, Theresa.");
    expect(recap.headline).toContain("closed");
    expect(recap.closedToday).toHaveLength(3);
    expect(recap.rolledToTomorrow).toHaveLength(2);
    expect(recap.areaBreakdown).toContain("Operations");
    expect(recap.reflectionPrompt).toMatch(/\?$/);
    expect(recap.signoff).toMatch(/Tomorrow/);
    expect(recap.source).toBe("rules");
    expect(recap.reflection).toBeNull();
  });

  it("greets without 'Good' to keep tone confident", () => {
    const recap = buildRulesRecap(makeInput());
    expect(recap.greeting.startsWith("Good ")).toBe(false);
    expect(recap.greeting.startsWith("Evening")).toBe(true);
  });

  it("handles a quiet day (nothing closed, nothing rolled)", () => {
    const recap = buildRulesRecap(
      makeInput({ closedToday: [], openToday: [] }),
    );
    expect(recap.closedToday).toHaveLength(0);
    expect(recap.rolledToTomorrow).toHaveLength(0);
    expect(recap.headline).toMatch(/quiet/i);
    expect(recap.areaBreakdown).toMatch(/clean slate/i);
  });

  it("handles all-closed day with no rolled items", () => {
    const recap = buildRulesRecap(
      makeInput({ openToday: [] }),
    );
    expect(recap.headline).toMatch(/Solid/);
    expect(recap.headline).toContain("3 of 3");
  });

  it("preserves task ordering for closedToday", () => {
    const recap = buildRulesRecap(makeInput());
    expect(recap.closedToday[0]?.title).toBe("Pay out income tax");
    expect(recap.closedToday[2]?.title).toBe("Outline blog post");
  });

  it("rolls pending and blocked tasks into rolledToTomorrow", () => {
    const recap = buildRulesRecap(makeInput());
    const titles = recap.rolledToTomorrow.map((t) => t.title);
    expect(titles).toContain("Schedule call");
    expect(titles).toContain("Email vendor");
  });

  it("falls back to 'Unassigned' for tasks without a pillar", () => {
    const recap = buildRulesRecap(
      makeInput({ closedToday: [task(99, "Solo task", null)] }),
    );
    expect(recap.closedToday[0]?.pillarName).toBe("Unassigned");
  });
});

describe("computeAreaBreakdown", () => {
  it("groups by pillar and sorts by closed count", () => {
    const pillars = [pillar(1, "Operations"), pillar(2, "Side Quest")];
    const tasks = [
      task(1, "a", 1),
      task(2, "b", 1),
      task(3, "c", 2),
    ];
    const breakdown = computeAreaBreakdown(tasks, pillars);
    expect(breakdown[0]?.pillarName).toBe("Operations");
    expect(breakdown[0]?.closedCount).toBe(2);
    expect(breakdown[1]?.pillarName).toBe("Side Quest");
  });

  it("returns empty array when nothing closed", () => {
    expect(computeAreaBreakdown([], [pillar(1, "Operations")])).toEqual([]);
  });
});

describe("pickReflectionPrompt", () => {
  it("rotates through the prompt pool deterministically", () => {
    expect(pickReflectionPrompt(0)).toBe(REFLECTION_PROMPTS[0]);
    expect(pickReflectionPrompt(REFLECTION_PROMPTS.length)).toBe(REFLECTION_PROMPTS[0]);
    expect(pickReflectionPrompt(1)).toBe(REFLECTION_PROMPTS[1]);
  });

  it("handles negative indices safely", () => {
    expect(pickReflectionPrompt(-1)).toBe(
      REFLECTION_PROMPTS[REFLECTION_PROMPTS.length - 1],
    );
  });
});
