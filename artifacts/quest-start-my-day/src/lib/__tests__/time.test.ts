import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TIMEZONE,
  getUserToday,
  getWeekEnd,
  getWeekKey,
  resolveTimezone,
  shiftDateString,
} from "../time";

describe("resolveTimezone", () => {
  it("returns the supplied timezone when present", () => {
    expect(resolveTimezone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("falls back to America/Toronto when undefined/null/empty", () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone("")).toBe(DEFAULT_TIMEZONE);
  });
});

describe("getUserToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the same calendar date in Toronto when UTC has already rolled over", () => {
    vi.setSystemTime(new Date("2026-04-27T03:30:00Z"));
    expect(getUserToday("America/Toronto")).toBe("2026-04-26");
    expect(getUserToday("UTC")).toBe("2026-04-27");
  });

  it("respects the default timezone when none provided", () => {
    vi.setSystemTime(new Date("2026-04-27T03:30:00Z"));
    expect(getUserToday()).toBe("2026-04-26");
  });
});

describe("getWeekKey (frontend mirror of backend)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("floors a mid-week Toronto date to Monday", () => {
    expect(getWeekKey("2026-04-27", "America/Toronto")).toBe("2026-04-27");
    expect(getWeekKey("2026-04-29", "America/Toronto")).toBe("2026-04-27");
  });

  it("Sunday is treated as the last day of the previous week", () => {
    expect(getWeekKey("2026-05-03", "America/Toronto")).toBe("2026-04-27");
  });

  it("rolls back across a month boundary", () => {
    expect(getWeekKey("2026-05-01", "America/Toronto")).toBe("2026-04-27");
  });

  it("rolls back across a year boundary", () => {
    expect(getWeekKey("2026-01-01", "America/Toronto")).toBe("2025-12-29");
  });

  it("returns the current week when called with no args", () => {
    vi.setSystemTime(new Date("2026-04-29T15:00:00Z"));
    expect(getWeekKey()).toBe("2026-04-27");
  });
});

describe("shiftDateString / getWeekEnd", () => {
  it("shifts forward and backward across month and year boundaries", () => {
    expect(shiftDateString("2026-05-01", -7)).toBe("2026-04-24");
    expect(shiftDateString("2025-12-29", 7)).toBe("2026-01-05");
  });

  it("getWeekEnd returns Sunday given a Monday", () => {
    expect(getWeekEnd("2026-04-27")).toBe("2026-05-03");
  });
});
