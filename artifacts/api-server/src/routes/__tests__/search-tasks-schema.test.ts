import { describe, expect, it } from "vitest";
import { SearchTasksQueryParams } from "@workspace/api-zod";

describe("SearchTasksQueryParams", () => {
  it("accepts an empty query (defaults are server-side)", () => {
    const r = SearchTasksQueryParams.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts each bucket value", () => {
    for (const bucket of ["unprocessed", "all", "completed"] as const) {
      const r = SearchTasksQueryParams.safeParse({ bucket });
      expect(r.success).toBe(true);
    }
  });

  it("rejects an unknown bucket", () => {
    const r = SearchTasksQueryParams.safeParse({ bucket: "garbage" });
    expect(r.success).toBe(false);
  });

  it("accepts a free-text q", () => {
    const r = SearchTasksQueryParams.safeParse({ q: "rebrand sara" });
    expect(r.success).toBe(true);
  });

  it("accepts an areaId and coerces from string", () => {
    const r = SearchTasksQueryParams.safeParse({ areaId: "12" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.areaId).toBe(12);
  });

  it("rejects a non-positive areaId", () => {
    const r = SearchTasksQueryParams.safeParse({ areaId: 0 });
    expect(r.success).toBe(false);
  });

  it("accepts each known status", () => {
    for (const status of [
      "pending",
      "done",
      "pushed",
      "passed",
      "blocked",
      "stepped_back",
    ] as const) {
      const r = SearchTasksQueryParams.safeParse({ status });
      expect(r.success).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    const r = SearchTasksQueryParams.safeParse({ status: "halfway" });
    expect(r.success).toBe(false);
  });

  it("caps limit at 500", () => {
    const r = SearchTasksQueryParams.safeParse({ limit: 9999 });
    expect(r.success).toBe(false);
  });

  it("rejects a non-positive limit", () => {
    const r = SearchTasksQueryParams.safeParse({ limit: 0 });
    expect(r.success).toBe(false);
  });
});
