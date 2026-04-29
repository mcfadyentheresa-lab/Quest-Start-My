import { describe, expect, it } from "vitest";
import { CreateTaskBody } from "@workspace/api-zod";

describe("CreateTaskBody — area is optional (Phase 8)", () => {
  it("accepts a task without an areaId", () => {
    const result = CreateTaskBody.safeParse({
      title: "Sweep the porch",
      category: "wellness",
      date: "2026-04-28",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a task with an explicit null areaId", () => {
    const result = CreateTaskBody.safeParse({
      title: "Sweep the porch",
      category: "wellness",
      date: "2026-04-28",
      areaId: null,
    });
    expect(result.success).toBe(true);
  });

  it("still accepts a task with an areaId", () => {
    const result = CreateTaskBody.safeParse({
      title: "Sweep the porch",
      category: "wellness",
      date: "2026-04-28",
      areaId: 7,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a task missing a title", () => {
    const result = CreateTaskBody.safeParse({
      category: "wellness",
      date: "2026-04-28",
    });
    expect(result.success).toBe(false);
  });
});
