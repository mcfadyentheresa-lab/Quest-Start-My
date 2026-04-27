import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUserToday,
  getWeekKey,
  getWeekStart,
  shiftYmd,
  parseUserDate,
  validateViewDate,
  resolveTimezone,
  DEFAULT_TIMEZONE,
} from "../time";
import { ApiError } from "../errors";

describe("resolveTimezone", () => {
  it("returns the supplied tz when truthy", () => {
    expect(resolveTimezone("America/New_York")).toBe("America/New_York");
  });
  it("falls back to the default when null/undefined/empty", () => {
    expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone("")).toBe(DEFAULT_TIMEZONE);
    expect(resolveTimezone("   ")).toBe(DEFAULT_TIMEZONE);
  });
});

describe("getUserToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD in the user's tz at the day boundary", () => {
    // 2026-04-27T03:30Z is 2026-04-26 in America/Toronto (UTC-4 in DST)
    vi.setSystemTime(new Date("2026-04-27T03:30:00Z"));
    expect(getUserToday("America/Toronto")).toBe("2026-04-26");
    expect(getUserToday("UTC")).toBe("2026-04-27");
    expect(getUserToday("Asia/Tokyo")).toBe("2026-04-27");
  });

  it("returns the next-day for Asia/Tokyo when UTC is late evening", () => {
    vi.setSystemTime(new Date("2026-04-27T22:00:00Z"));
    expect(getUserToday("Asia/Tokyo")).toBe("2026-04-28");
    expect(getUserToday("UTC")).toBe("2026-04-27");
  });
});

describe("getWeekStart (Monday-anchored, in user tz)", () => {
  it("anchors Sunday to the previous Monday", () => {
    // 2026-04-26 is a Sunday in any tz
    expect(getWeekStart("2026-04-26", "America/Toronto")).toBe("2026-04-20");
  });
  it("returns the same date when given a Monday", () => {
    // 2026-04-27 is a Monday
    expect(getWeekStart("2026-04-27", "America/Toronto")).toBe("2026-04-27");
  });
  it("anchors mid-week to Monday", () => {
    expect(getWeekStart("2026-04-30", "America/Toronto")).toBe("2026-04-27");
  });
  it("works around DST forward transition (US spring forward)", () => {
    // 2026-03-08 is the US DST start (a Sunday). Week starts on Mar 2.
    expect(getWeekStart("2026-03-08", "America/Toronto")).toBe("2026-03-02");
    expect(getWeekStart("2026-03-09", "America/Toronto")).toBe("2026-03-09");
  });
  it("works around DST backward transition", () => {
    // 2026-11-01 is the US DST end (a Sunday). Week starts on Oct 26.
    expect(getWeekStart("2026-11-01", "America/Toronto")).toBe("2026-10-26");
  });
});

describe("getWeekKey (ISO 8601 week, in user tz)", () => {
  it("returns the ISO week for a mid-week date", () => {
    expect(getWeekKey(new Date("2026-04-27T12:00:00Z"), "UTC")).toBe("2026-W18");
  });
  it("handles year boundary correctly", () => {
    // 2025-01-01 is a Wednesday — ISO week 1 of 2025
    expect(getWeekKey(new Date("2025-01-01T12:00:00Z"), "UTC")).toBe("2025-W01");
  });
  it("handles week 53 / week 1 spanning year boundary", () => {
    // ISO week of 2024-12-30 is 2025-W01
    expect(getWeekKey(new Date("2024-12-30T12:00:00Z"), "UTC")).toBe("2025-W01");
  });
  it("returns different weeks across midnight in different tz", () => {
    // 2026-01-04T05:30Z = 2026-01-04 (Sun) in UTC, but 2026-01-04 00:30 in -05.
    // Sunday = ISO W01 ending. Both should be W01 since same calendar day.
    const d = new Date("2026-01-04T05:30:00Z");
    expect(getWeekKey(d, "America/Toronto")).toBe("2026-W01");
    expect(getWeekKey(d, "UTC")).toBe("2026-W01");
  });
});

describe("shiftYmd", () => {
  it("adds positive days", () => {
    expect(shiftYmd("2026-04-27", 6)).toBe("2026-05-03");
  });
  it("subtracts negative days", () => {
    expect(shiftYmd("2026-04-27", -7)).toBe("2026-04-20");
  });
  it("crosses month boundary", () => {
    expect(shiftYmd("2026-01-31", 1)).toBe("2026-02-01");
  });
  it("crosses year boundary", () => {
    expect(shiftYmd("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("handles leap day correctly", () => {
    expect(shiftYmd("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftYmd("2025-02-28", 1)).toBe("2025-03-01");
  });
});

describe("parseUserDate", () => {
  it("returns local-midnight UTC instant for the given tz", () => {
    const d = parseUserDate("2026-04-27", "America/Toronto");
    // 2026-04-27 00:00 Toronto = 04:00 UTC (DST)
    expect(d.toISOString()).toBe("2026-04-27T04:00:00.000Z");
  });
  it("respects non-DST winter offset", () => {
    const d = parseUserDate("2026-01-15", "America/Toronto");
    // EST = UTC-5
    expect(d.toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });
  it("supports far-east tz", () => {
    const d = parseUserDate("2026-04-27", "Asia/Tokyo");
    // JST = UTC+9 (no DST)
    expect(d.toISOString()).toBe("2026-04-26T15:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(() => parseUserDate("not-a-date", "UTC")).toThrow(ApiError);
  });
});

describe("validateViewDate", () => {
  it("passes through null/undefined/empty", () => {
    expect(validateViewDate(undefined)).toBeNull();
    expect(validateViewDate(null)).toBeNull();
    expect(validateViewDate("")).toBeNull();
  });
  it("accepts valid YYYY-MM-DD", () => {
    expect(validateViewDate("2026-04-27")).toBe("2026-04-27");
  });
  it("rejects malformed strings", () => {
    expect(() => validateViewDate("2026/04/27")).toThrow(ApiError);
    expect(() => validateViewDate("26-04-27")).toThrow(ApiError);
    expect(() => validateViewDate("2026-4-27")).toThrow(ApiError);
    expect(() => validateViewDate("not-a-date")).toThrow(ApiError);
  });
  it("rejects non-string types", () => {
    expect(() => validateViewDate(20260427)).toThrow(ApiError);
    expect(() => validateViewDate({ date: "2026-04-27" })).toThrow(ApiError);
    expect(() => validateViewDate(["2026-04-27"])).toThrow(ApiError);
  });
  it("rejects calendar-impossible dates", () => {
    expect(() => validateViewDate("2026-02-31")).toThrow(ApiError);
    expect(() => validateViewDate("2026-13-01")).toThrow(ApiError);
    expect(() => validateViewDate("2026-04-32")).toThrow(ApiError);
  });
  it("includes the param name in the error", () => {
    try {
      validateViewDate("oops", "weekOf");
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toContain("weekOf");
    }
  });
});
