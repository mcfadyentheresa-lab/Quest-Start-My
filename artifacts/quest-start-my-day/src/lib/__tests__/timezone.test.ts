import { describe, expect, it } from "vitest";
import { getLocalHour, isAfterLocalHour, OWNER_TIMEZONE } from "../timezone";

describe("client timezone helpers", () => {
  it("OWNER_TIMEZONE is America/Toronto", () => {
    expect(OWNER_TIMEZONE).toBe("America/Toronto");
  });

  it("isAfterLocalHour swaps at 5pm Toronto time", () => {
    // 4:59pm EDT = 20:59 UTC → still morning briefing
    const beforeFive = new Date("2026-04-28T20:59:00Z");
    expect(isAfterLocalHour(beforeFive, 17, "America/Toronto")).toBe(false);

    // 5:00pm EDT = 21:00 UTC → swap to evening recap
    const atFive = new Date("2026-04-28T21:00:00Z");
    expect(isAfterLocalHour(atFive, 17, "America/Toronto")).toBe(true);
  });

  it("returns to morning briefing at midnight", () => {
    // 11:59pm EDT
    const lateEdt = new Date("2026-04-29T03:59:00Z");
    expect(isAfterLocalHour(lateEdt, 17, "America/Toronto")).toBe(true);
    // 12:00am EDT next day
    const midnightEdt = new Date("2026-04-29T04:00:00Z");
    expect(isAfterLocalHour(midnightEdt, 17, "America/Toronto")).toBe(false);
  });

  it("threshold is timezone-sensitive", () => {
    // 21:30 UTC: 17:30 Toronto (after) vs 14:30 Los Angeles (before)
    const instant = new Date("2026-04-28T21:30:00Z");
    expect(isAfterLocalHour(instant, 17, "America/Toronto")).toBe(true);
    expect(isAfterLocalHour(instant, 17, "America/Los_Angeles")).toBe(false);
  });

  it("getLocalHour normalises 24 to 0 at midnight rollover", () => {
    const date = new Date("2026-04-28T04:00:00Z"); // 00:00 EDT
    expect(getLocalHour(date, "America/Toronto")).toBe(0);
  });
});
