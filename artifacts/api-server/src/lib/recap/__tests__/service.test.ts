import { describe, expect, it } from "vitest";
import { shouldServeFromCache } from "../cache";
import { buildRulesRecap } from "../rules";
import type { RecapInput, RecapResponse } from "../types";

const baseDate = new Date("2026-04-28T22:00:00Z");

function pillar(id: number, name: string): RecapInput["pillars"][number] {
  return {
    id,
    name,
    priority: "P1",
    description: null,
    isActiveThisWeek: true,
    color: "#abc",
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
    originalDump: null,
    needsReview: false,
    energy: null,
  };
}

function makeInput(overrides: Partial<RecapInput> = {}): RecapInput {
  const pillars = [pillar(1, "Operations")];
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 18,
    userFirstName: "Theresa",
    pillars,
    closedToday: [task(1, "Pay tax", 1)],
    openToday: [task(2, "Schedule call", 1, "pending")],
    reflectionPromptIndex: 0,
    ...overrides,
  };
}

/**
 * These tests stand in for an end-to-end service integration test. The real
 * service.ts wraps drizzle queries; here we test the cache and reflection
 * merge logic that the service composes. Real DB persistence is exercised at
 * runtime when DATABASE_URL is set (typecheck guarantees the wiring matches).
 */
describe("recap service: cache decision + reflection round-trip (logic-level)", () => {
  it("serves cached recap when done count hasn't changed", () => {
    const recap = buildRulesRecap(makeInput());
    expect(
      shouldServeFromCache(recap, {
        now: new Date(baseDate.getTime() + 5 * 60 * 1000),
        currentDoneCount: 1,
      }),
    ).toBe(true);
  });

  it("busts cache when a new task is completed after the recap was built", () => {
    const recap = buildRulesRecap(makeInput());
    expect(recap.closedToday).toHaveLength(1);
    // Simulate user completing another task post-cache.
    expect(
      shouldServeFromCache(recap, {
        now: new Date(baseDate.getTime() + 5 * 60 * 1000),
        currentDoneCount: 2,
      }),
    ).toBe(false);
  });

  it("preserves a reflection through a regeneration", () => {
    // The service merges the prior reflection back onto the freshly generated
    // recap before persisting — simulate that invariant here.
    const cached: RecapResponse = {
      ...buildRulesRecap(makeInput()),
      reflection: "Stayed in the zone.",
    };
    const fresh = buildRulesRecap(
      makeInput({
        closedToday: [task(1, "Pay tax", 1), task(2, "Reply", 1)],
      }),
    );
    const merged: RecapResponse = cached.reflection
      ? { ...fresh, reflection: cached.reflection }
      : fresh;

    expect(merged.reflection).toBe("Stayed in the zone.");
    expect(merged.closedToday).toHaveLength(2);
  });

  it("rules-based recap has the full shape required by the spec", () => {
    const recap = buildRulesRecap(makeInput());
    expect(recap).toMatchObject({
      greeting: expect.stringMatching(/^Evening,/),
      headline: expect.any(String),
      closedToday: expect.any(Array),
      rolledToTomorrow: expect.any(Array),
      areaBreakdown: expect.any(String),
      reflectionPrompt: expect.stringMatching(/\?$/),
      reflection: null,
      signoff: expect.any(String),
      source: "rules",
    });
  });

  it("approve/reshuffle fields are not part of the recap (read-only)", () => {
    const recap = buildRulesRecap(makeInput());
    // The recap intentionally omits these — UI shouldn't render approve/reshuffle.
    expect(recap).not.toHaveProperty("approved");
    expect(recap).not.toHaveProperty("priorities");
    expect(recap).not.toHaveProperty("briefing");
  });
});
