import { describe, expect, it } from "vitest";
import { isCacheFresh, shouldServeFromCache, CACHE_TTL_MS } from "../cache";
import type { RecapResponse } from "../types";

const now = new Date("2026-04-28T22:00:00Z");

function makeRecap(overrides: Partial<RecapResponse> = {}): RecapResponse {
  return {
    greeting: "Evening, Theresa.",
    headline: "Solid day — closed 2 of 3.",
    closedToday: [
      {
        taskId: 1,
        title: "a",
        pillarName: "Operations",
        pillarColor: null,
      },
      {
        taskId: 2,
        title: "b",
        pillarName: "Operations",
        pillarColor: null,
      },
    ],
    rolledToTomorrow: [
      {
        taskId: 3,
        title: "c",
        pillarName: "Operations",
        pillarColor: null,
      },
    ],
    areaBreakdown: "Most of today lived in Operations.",
    reflectionPrompt: "What surprised you today?",
    reflection: null,
    signoff: "Rest up. Tomorrow's plan is staged.",
    date: "2026-04-28",
    source: "rules",
    generatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("isCacheFresh", () => {
  it("returns true within the TTL window", () => {
    expect(isCacheFresh(makeRecap().generatedAt, now)).toBe(true);
  });

  it("returns false past the TTL window", () => {
    const stale = new Date(now.getTime() - CACHE_TTL_MS - 1);
    expect(isCacheFresh(stale, now)).toBe(false);
  });
});

describe("shouldServeFromCache", () => {
  it("serves from cache when fresh and counts match", () => {
    expect(shouldServeFromCache(makeRecap(), { now, currentDoneCount: 2 })).toBe(true);
  });

  it("does not serve when bypassCache is true", () => {
    expect(shouldServeFromCache(makeRecap(), { now, bypassCache: true })).toBe(false);
  });

  it("busts cache when current done count differs (user closed a task)", () => {
    const cached = makeRecap();
    expect(shouldServeFromCache(cached, { now, currentDoneCount: 3 })).toBe(false);
  });

  it("busts cache when current done count is lower (user un-completed)", () => {
    expect(shouldServeFromCache(makeRecap(), { now, currentDoneCount: 1 })).toBe(false);
  });

  it("serves from cache when currentDoneCount is undefined (signal not available)", () => {
    expect(shouldServeFromCache(makeRecap(), { now })).toBe(true);
  });

  it("does not serve when entry is stale", () => {
    const stale = makeRecap({
      generatedAt: new Date(now.getTime() - CACHE_TTL_MS - 1).toISOString(),
    });
    expect(shouldServeFromCache(stale, { now, currentDoneCount: 2 })).toBe(false);
  });

  it("returns false when no cache entry is provided", () => {
    expect(shouldServeFromCache(null, { now })).toBe(false);
  });
});
