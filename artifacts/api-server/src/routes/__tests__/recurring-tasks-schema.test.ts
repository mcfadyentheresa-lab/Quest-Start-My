import { describe, expect, it } from "vitest";
import { CreateRecurringTaskBody, UpdateRecurringTaskBody } from "@workspace/api-zod";

describe("CreateRecurringTaskBody", () => {
  it("accepts a daily template", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "Post morning update",
      frequency: "daily",
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a weekly template with weekdays", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "Schedule social posts",
      frequency: "weekly",
      weekdays: [1, 3, 5],
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a monthly template with dayOfMonth", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "Pay rent",
      frequency: "monthly",
      dayOfMonth: 1,
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a body without title", () => {
    const result = CreateRecurringTaskBody.safeParse({
      frequency: "daily",
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown frequency", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "x",
      frequency: "yearly",
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a weekday outside 0..6", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "x",
      frequency: "weekly",
      weekdays: [7],
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth above 31", () => {
    const result = CreateRecurringTaskBody.safeParse({
      title: "x",
      frequency: "monthly",
      dayOfMonth: 32,
      startDate: "2026-05-04",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateRecurringTaskBody", () => {
  it("accepts an empty body (no-op patch)", () => {
    const result = UpdateRecurringTaskBody.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a pause via pausedAt timestamp", () => {
    const result = UpdateRecurringTaskBody.safeParse({
      pausedAt: "2026-05-04T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a resume via pausedAt: null", () => {
    const result = UpdateRecurringTaskBody.safeParse({
      pausedAt: null,
    });
    expect(result.success).toBe(true);
  });
});
