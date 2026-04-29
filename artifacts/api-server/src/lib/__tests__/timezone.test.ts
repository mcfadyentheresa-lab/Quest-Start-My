import { describe, expect, it } from "vitest";
import { getLocalHour, isAfterLocalHour, OWNER_TIMEZONE } from "../timezone";

describe("timezone helpers", () => {
  describe("getLocalHour", () => {
    it("returns the hour in America/Toronto for a UTC instant during EDT", () => {
      // 2026-07-15 18:00 UTC = 14:00 EDT (UTC-4)
      const date = new Date("2026-07-15T18:00:00Z");
      expect(getLocalHour(date, "America/Toronto")).toBe(14);
    });

    it("returns the hour in America/Toronto for a UTC instant during EST", () => {
      // 2026-01-15 18:00 UTC = 13:00 EST (UTC-5)
      const date = new Date("2026-01-15T18:00:00Z");
      expect(getLocalHour(date, "America/Toronto")).toBe(13);
    });

    it("uses owner timezone (Toronto) by default", () => {
      const date = new Date("2026-04-28T21:30:00Z"); // EDT → 17:30
      expect(getLocalHour(date)).toBe(17);
      expect(OWNER_TIMEZONE).toBe("America/Toronto");
    });

    it("works for UTC", () => {
      const date = new Date("2026-04-28T22:00:00Z");
      expect(getLocalHour(date, "UTC")).toBe(22);
    });
  });

  describe("isAfterLocalHour", () => {
    it("is false at 4:59pm Toronto time (before 5pm threshold)", () => {
      // 2026-04-28 16:59 EDT = 20:59 UTC
      const date = new Date("2026-04-28T20:59:00Z");
      expect(isAfterLocalHour(date, 17, "America/Toronto")).toBe(false);
    });

    it("is true at 5:00pm Toronto time (at the threshold)", () => {
      // 2026-04-28 17:00 EDT = 21:00 UTC
      const date = new Date("2026-04-28T21:00:00Z");
      expect(isAfterLocalHour(date, 17, "America/Toronto")).toBe(true);
    });

    it("is true at 11:59pm Toronto time", () => {
      // 2026-04-28 23:59 EDT = 2026-04-29 03:59 UTC
      const date = new Date("2026-04-29T03:59:00Z");
      expect(isAfterLocalHour(date, 17, "America/Toronto")).toBe(true);
    });

    it("is false at midnight Toronto time (next day, briefing again)", () => {
      // 2026-04-29 00:00 EDT = 04:00 UTC
      const date = new Date("2026-04-29T04:00:00Z");
      expect(isAfterLocalHour(date, 17, "America/Toronto")).toBe(false);
    });

    it("threshold flips at 5pm in UTC for UTC users", () => {
      const beforeUtc = new Date("2026-04-28T16:30:00Z");
      const afterUtc = new Date("2026-04-28T17:30:00Z");
      expect(isAfterLocalHour(beforeUtc, 17, "UTC")).toBe(false);
      expect(isAfterLocalHour(afterUtc, 17, "UTC")).toBe(true);
    });

    it("threshold differs across timezones at the same UTC instant", () => {
      // 2026-04-28 21:30 UTC = 17:30 EDT (after threshold) but 21:30 UTC (after) and 14:30 PDT (before)
      const instant = new Date("2026-04-28T21:30:00Z");
      expect(isAfterLocalHour(instant, 17, "America/Toronto")).toBe(true);
      expect(isAfterLocalHour(instant, 17, "America/Los_Angeles")).toBe(false);
      expect(isAfterLocalHour(instant, 17, "UTC")).toBe(true);
    });
  });
});
