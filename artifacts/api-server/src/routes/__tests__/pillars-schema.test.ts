import { describe, expect, it } from "vitest";
import { CreatePillarBody, UpdatePillarBody } from "@workspace/api-zod";

describe("Phase 3: pillar zod schemas", () => {
  it("CreatePillarBody no longer accepts priority", () => {
    const parsed = CreatePillarBody.safeParse({
      name: "Pillar A",
      priority: "P1",
      portfolioStatus: "Active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).priority).toBeUndefined();
    }
  });

  it("CreatePillarBody no longer accepts isActiveThisWeek", () => {
    const parsed = CreatePillarBody.safeParse({
      name: "Pillar B",
      isActiveThisWeek: true,
      portfolioStatus: "Active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).isActiveThisWeek).toBeUndefined();
    }
  });

  it("CreatePillarBody accepts the post-Phase-3 minimal payload", () => {
    const parsed = CreatePillarBody.safeParse({
      name: "Pillar C",
    });
    expect(parsed.success).toBe(true);
  });

  it("UpdatePillarBody no longer accepts priority or isActiveThisWeek", () => {
    const parsed = UpdatePillarBody.safeParse({
      name: "Renamed",
      priority: "P2",
      isActiveThisWeek: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).priority).toBeUndefined();
      expect((parsed.data as Record<string, unknown>).isActiveThisWeek).toBeUndefined();
    }
  });
});
