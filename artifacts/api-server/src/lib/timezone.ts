/**
 * Default timezone for owner mode (Theresa). Other users will eventually
 * provide their own zone via Clerk profile / user preferences.
 */
export const OWNER_TIMEZONE = "America/Toronto";

/**
 * Returns the local hour (0-23) in the given timezone for a given Date.
 * Uses Intl.DateTimeFormat under the hood so it handles DST correctly.
 */
export function getLocalHour(date: Date, timeZone: string = OWNER_TIMEZONE): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  // hourCycle/hour12 settings can yield "24" for midnight on some platforms;
  // normalise to 0-23.
  const parts = fmt.formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number.parseInt(hourPart, 10);
  if (!Number.isFinite(hour)) return 0;
  return hour === 24 ? 0 : hour;
}

/**
 * True if the given Date is at or past `hour` (0-23) in the given timezone.
 * Used to swap the morning briefing for the evening recap on the dashboard.
 */
export function isAfterLocalHour(
  date: Date,
  hour: number,
  timeZone: string = OWNER_TIMEZONE,
): boolean {
  return getLocalHour(date, timeZone) >= hour;
}

/**
 * Returns the YYYY-MM-DD date string in the given timezone.
 */
export function getLocalDate(date: Date, timeZone: string = OWNER_TIMEZONE): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}
