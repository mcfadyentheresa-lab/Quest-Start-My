import { describe, expect, it } from "vitest";
import {
  UpdateWeeklyPlanPrioritiesBody,
  UpdateWeeklyPlanPrioritiesParams,
} from "@workspace/api-zod";

describe("Phase 3: weekly plan priorities endpoint zod schemas", () => {
  it("accepts a valid pillarPriorities map with P1-P4 values", () => {
    const parsed = UpdateWeeklyPlanPrioritiesBody.safeParse({
      pillarPriorities: { "1": "P1", "2": "P2", "7": "P4" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty pillarPriorities map", () => {
    const parsed = UpdateWeeklyPlanPrioritiesBody.safeParse({
      pillarPriorities: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects priority values outside P1-P4", () => {
    const parsed = UpdateWeeklyPlanPrioritiesBody.safeParse({
      pillarPriorities: { "1": "P5" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects when pillarPriorities is missing", () => {
    const parsed = UpdateWeeklyPlanPrioritiesBody.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("requires a non-empty weekKey path param", () => {
    const ok = UpdateWeeklyPlanPrioritiesParams.safeParse({ weekKey: "2026-04-27" });
    expect(ok.success).toBe(true);
  });
});
