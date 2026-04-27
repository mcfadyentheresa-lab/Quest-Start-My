import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TIMEZONE,
  getUserNow,
  getUserToday,
  getWeekEnd,
  getWeekKey,
  parseDateString,
  parseViewDate,
  resolveTimezone,
  shiftDateString,
} from "../time";
import { ApiError } from "../errors";

describe("resolveTimezone", () => {
  it("returns the supplied timezone when present", () => {
    expect(resolveTimezone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("falls back to America/Toronto when undefined", () => {
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone("")).toBe(DEFAULT_TIMEZONE);
  });
});

describe("getUserToday / getUserNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the same calendar date in Toronto when UTC has already rolled over", () => {
    // 2026-04-27 03:30 UTC = 2026-04-26 23:30 in Toronto (EDT, UTC-4)
    vi.setSystemTime(new Date("2026-04-27T03:30:00Z"));
    expect(getUserToday("America/Toronto")).toBe("2026-04-26");
    expect(getUserToday("UTC")).toBe("2026-04-27");
  });

  it("returns yesterday in Toronto when UTC is just past midnight Tokyo time", () => {
    // 2026-04-27 00:00 UTC = 2026-04-26 20:00 in Toronto, 2026-04-27 09:00 in Tokyo
    vi.setSystemTime(new Date("2026-04-27T00:00:00Z"));
    expect(getUserToday("America/Toronto")).toBe("2026-04-26");
    expect(getUserToday("Asia/Tokyo")).toBe("2026-04-27");
  });

  it("returns the correct date across DST spring-forward in Toronto", () => {
    // DST started 2026-03-08 at 02:00 EST -> 03:00 EDT.
    // 2026-03-08 06:30 UTC = 02:30 EDT (right after the jump).
    vi.setSystemTime(new Date("2026-03-08T06:30:00Z"));
    expect(getUserToday("America/Toronto")).toBe("2026-03-08");
  });

  it("getUserNow returns a Date instance", () => {
    vi.setSystemTime(new Date("2026-04-27T15:00:00Z"));
    const now = getUserNow("America/Toronto");
    expect(now).toBeInstanceOf(Date);
  });
});

describe("getWeekKey", () => {
  it("floors a mid-week Toronto date to Monday", () => {
    // 2026-04-27 (Mon) is itself a Monday in Toronto.
    expect(getWeekKey("2026-04-27", "America/Toronto")).toBe("2026-04-27");
    // 2026-04-29 (Wed) -> Mon 2026-04-27
    expect(getWeekKey("2026-04-29", "America/Toronto")).toBe("2026-04-27");
  });

  it("Sunday is treated as the last day of the previous week", () => {
    // 2026-05-03 is a Sunday -> Monday 2026-04-27
    expect(getWeekKey("2026-05-03", "America/Toronto")).toBe("2026-04-27");
  });

  it("handles a Saturday correctly", () => {
    // 2026-05-02 (Sat) -> Monday 2026-04-27
    expect(getWeekKey("2026-05-02", "America/Toronto")).toBe("2026-04-27");
  });

  it("rolls back across a month boundary", () => {
    // 2026-05-01 (Fri) -> Monday 2026-04-27
    expect(getWeekKey("2026-05-01", "America/Toronto")).toBe("2026-04-27");
  });

  it("rolls back across a year boundary", () => {
    // 2026-01-01 is a Thursday -> Monday 2025-12-29
    expect(getWeekKey("2026-01-01", "America/Toronto")).toBe("2025-12-29");
  });

  it("agrees with the legacy Monday-floor rule across DST fall-back", () => {
    // DST ends 2026-11-01 in Toronto. 2026-11-01 is a Sunday -> Monday 2026-10-26.
    expect(getWeekKey("2026-11-01", "America/Toronto")).toBe("2026-10-26");
    // The Tuesday after the change should still float to that same Monday's
    // following week start (2026-11-02 is itself a Monday).
    expect(getWeekKey("2026-11-03", "America/Toronto")).toBe("2026-11-02");
  });

  it("handles a non-UTC offset timezone like Asia/Kathmandu (+05:45)", () => {
    // 2026-04-27 (Mon) — Kathmandu has a non-integer offset.
    expect(getWeekKey("2026-04-27", "Asia/Kathmandu")).toBe("2026-04-27");
    // 2026-05-04 (Mon)
    expect(getWeekKey("2026-05-04", "Asia/Kathmandu")).toBe("2026-05-04");
  });
});

describe("getWeekEnd / shiftDateString", () => {
  it("getWeekEnd returns Sunday given a Monday", () => {
    expect(getWeekEnd("2026-04-27")).toBe("2026-05-03");
  });

  it("shiftDateString moves backwards across a month boundary", () => {
    expect(shiftDateString("2026-05-01", -7)).toBe("2026-04-24");
  });

  it("shiftDateString moves forward across a year boundary", () => {
    expect(shiftDateString("2025-12-29", 7)).toBe("2026-01-05");
  });
});

describe("parseViewDate / parseDateString", () => {
  it("accepts a well-formed date", () => {
    expect(parseViewDate("2026-04-27")).toBe("2026-04-27");
    expect(parseDateString("2026-04-27", "weekOf")).toBe("2026-04-27");
  });

  it("rejects a malformed date with ApiError.badRequest", () => {
    expect(() => parseViewDate("2026/04/27")).toThrowError(ApiError);
    expect(() => parseViewDate("hello")).toThrowError(ApiError);
    expect(() => parseViewDate(undefined)).toThrowError(ApiError);
    expect(() => parseViewDate(123)).toThrowError(ApiError);
  });

  it("rejects an invalid calendar date even if shape matches", () => {
    expect(() => parseViewDate("2026-13-01")).toThrowError(ApiError);
    expect(() => parseViewDate("2026-02-30")).toThrowError(ApiError);
  });

  it("the thrown ApiError has 400 status and BAD_REQUEST code", () => {
    try {
      parseViewDate("nope");
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("BAD_REQUEST");
    }
  });
});
