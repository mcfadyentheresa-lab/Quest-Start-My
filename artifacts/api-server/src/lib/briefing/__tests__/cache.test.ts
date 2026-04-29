import { describe, expect, it } from "vitest";
import { isCacheFresh, shouldServeFromCache, CACHE_TTL_MS } from "../cache";
import type { BriefingResponse } from "../types";

const now = new Date("2026-04-28T12:00:00Z");

const briefing: BriefingResponse = {
  greeting: "Good morning, Theresa.",
  headline: "Three things matter today.",
  context: "Carrying momentum.",
  briefing: [],
  signoff: "I've got the rest of the week.",
  date: "2026-04-28",
  source: "rules",
  approved: false,
  generatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
};

describe("isCacheFresh", () => {
  it("returns true within the TTL window", () => {
    expect(isCacheFresh(briefing.generatedAt, now)).toBe(true);
  });

  it("returns false past the TTL window", () => {
    const stale = new Date(now.getTime() - CACHE_TTL_MS - 1);
    expect(isCacheFresh(stale, now)).toBe(false);
  });
});

describe("shouldServeFromCache", () => {
  it("serves from cache when fresh and no hint", () => {
    expect(shouldServeFromCache(briefing, { now })).toBe(true);
  });

  it("does not serve from cache when bypassCache is true", () => {
    expect(shouldServeFromCache(briefing, { now, bypassCache: true })).toBe(false);
  });

  it("does not serve from cache when a hint is supplied", () => {
    expect(shouldServeFromCache(briefing, { now, hint: "different" })).toBe(false);
  });

  it("does not serve from cache when entry is stale", () => {
    const stale = {
      ...briefing,
      generatedAt: new Date(now.getTime() - CACHE_TTL_MS - 1).toISOString(),
    };
    expect(shouldServeFromCache(stale, { now })).toBe(false);
  });

  it("returns false when no cache entry is provided", () => {
    expect(shouldServeFromCache(null, { now })).toBe(false);
  });
});
