import { describe, expect, it } from "vitest";
import { isDueOn, type RecurringCadenceInput } from "../recurring-due";

function makeTemplate(overrides: Partial<RecurringCadenceInput>): RecurringCadenceInput {
  return {
    frequency: "daily",
    weekdays: null,
    dayOfMonth: null,
    startDate: "2026-01-01",
    pausedAt: null,
    ...overrides,
  };
}

describe("isDueOn — daily", () => {
  it("is due any date on or after start", () => {
    const t = makeTemplate({ frequency: "daily", startDate: "2026-05-01" });
    expect(isDueOn(t, "2026-05-01")).toBe(true);
    expect(isDueOn(t, "2026-05-04")).toBe(true);
    expect(isDueOn(t, "2027-01-01")).toBe(true);
  });

  it("is not due before start date", () => {
    const t = makeTemplate({ frequency: "daily", startDate: "2026-05-10" });
    expect(isDueOn(t, "2026-05-09")).toBe(false);
  });

  it("is never due when paused", () => {
    const t = makeTemplate({ frequency: "daily", pausedAt: new Date("2026-05-04T00:00:00Z") });
    expect(isDueOn(t, "2026-05-04")).toBe(false);
  });
});

describe("isDueOn — weekly", () => {
  // 2026-05-04 is a Monday (weekday 1), 2026-05-05 is Tuesday (2).
  it("matches when today's weekday is in the list", () => {
    const t = makeTemplate({
      frequency: "weekly",
      weekdays: JSON.stringify([1, 3, 5]),
      startDate: "2026-01-01",
    });
    expect(isDueOn(t, "2026-05-04")).toBe(true); // Mon
    expect(isDueOn(t, "2026-05-06")).toBe(true); // Wed
    expect(isDueOn(t, "2026-05-08")).toBe(true); // Fri
  });

  it("does not match other weekdays", () => {
    const t = makeTemplate({
      frequency: "weekly",
      weekdays: JSON.stringify([1, 3, 5]),
      startDate: "2026-01-01",
    });
    expect(isDueOn(t, "2026-05-05")).toBe(false); // Tue
    expect(isDueOn(t, "2026-05-07")).toBe(false); // Thu
    expect(isDueOn(t, "2026-05-09")).toBe(false); // Sat
  });

  it("returns false when weekdays are missing or empty", () => {
    const empty = makeTemplate({ frequency: "weekly", weekdays: JSON.stringify([]) });
    expect(isDueOn(empty, "2026-05-04")).toBe(false);
    const missing = makeTemplate({ frequency: "weekly", weekdays: null });
    expect(isDueOn(missing, "2026-05-04")).toBe(false);
  });
});

describe("isDueOn — monthly", () => {
  it("matches dayOfMonth exactly when the month has it", () => {
    const t = makeTemplate({ frequency: "monthly", dayOfMonth: 15, startDate: "2026-01-01" });
    expect(isDueOn(t, "2026-05-15")).toBe(true);
    expect(isDueOn(t, "2026-05-14")).toBe(false);
    expect(isDueOn(t, "2026-05-16")).toBe(false);
  });

  it("clamps dayOfMonth=31 to the last day of shorter months", () => {
    const t = makeTemplate({ frequency: "monthly", dayOfMonth: 31, startDate: "2026-01-01" });
    // April has 30 days → due on the 30th.
    expect(isDueOn(t, "2026-04-30")).toBe(true);
    expect(isDueOn(t, "2026-04-29")).toBe(false);
    // February 2026 has 28 days (not a leap year).
    expect(isDueOn(t, "2026-02-28")).toBe(true);
    // May has 31 days → due on the 31st (no clamping).
    expect(isDueOn(t, "2026-05-31")).toBe(true);
    expect(isDueOn(t, "2026-05-30")).toBe(false);
  });

  it("returns false when dayOfMonth is missing", () => {
    const t = makeTemplate({ frequency: "monthly", dayOfMonth: null });
    expect(isDueOn(t, "2026-05-04")).toBe(false);
  });
});
