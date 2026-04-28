import { describe, expect, it } from "vitest";
import { buildFallbackBriefing, type BriefingContext } from "../briefing-fallback";

const baseCtx = (overrides: Partial<BriefingContext> = {}): BriefingContext => ({
  todayDate: "2026-04-28",
  weekOf: "2026-04-27",
  tasks: [],
  areas: [],
  weeklyPriorities: [],
  weeklyAreaIds: [],
  ...overrides,
});

describe("buildFallbackBriefing — area context narration", () => {
  it("names the single area when all of today's tasks ladder up to one area", () => {
    const ctx = baseCtx({
      tasks: [
        { id: 1, title: "A", status: "pending", areaId: 10 },
        { id: 2, title: "B", status: "pending", areaId: 10 },
      ],
      areas: [{ id: 10, name: "Operations" }],
    });
    const briefing = buildFallbackBriefing(ctx);
    expect(briefing.source).toBe("fallback");
    expect(briefing.narrative).toContain("*Operations*");
    expect(briefing.narrative).toMatch(/2 tasks/);
  });

  it("groups counts when tasks span multiple areas", () => {
    const ctx = baseCtx({
      tasks: [
        { id: 1, title: "A", status: "pending", areaId: 10 },
        { id: 2, title: "B", status: "done", areaId: 10 },
        { id: 3, title: "C", status: "pending", areaId: 20 },
        { id: 4, title: "D", status: "pending", areaId: 20 },
        { id: 5, title: "E", status: "pending", areaId: 20 },
      ],
      areas: [
        { id: 10, name: "Family" },
        { id: 20, name: "Operations" },
      ],
    });
    const briefing = buildFallbackBriefing(ctx);
    // The bigger group lands first
    expect(briefing.narrative).toContain("*Operations* (3)");
    expect(briefing.narrative).toContain("*Family* (2)");
  });

  it("calls out the weekly focus when set via areaPriorities", () => {
    const ctx = baseCtx({
      tasks: [{ id: 1, title: "A", status: "pending", areaId: 10 }],
      areas: [{ id: 10, name: "Operations" }],
      weeklyAreaIds: [10],
    });
    const briefing = buildFallbackBriefing(ctx);
    expect(briefing.narrative).toContain("weekly focus is *Operations*");
  });

  it("stays graceful when no tasks exist today", () => {
    const briefing = buildFallbackBriefing(baseCtx());
    expect(briefing.source).toBe("fallback");
    expect(briefing.narrative).toMatch(/Nothing on today's list/);
  });

  it("handles area-less tasks without crashing", () => {
    const ctx = baseCtx({
      tasks: [
        { id: 1, title: "A", status: "pending", areaId: null },
        { id: 2, title: "B", status: "pending", areaId: null },
      ],
      areas: [{ id: 10, name: "Operations" }],
    });
    const briefing = buildFallbackBriefing(ctx);
    expect(briefing.narrative).toMatch(/aren't scoped to an area/);
  });
});
