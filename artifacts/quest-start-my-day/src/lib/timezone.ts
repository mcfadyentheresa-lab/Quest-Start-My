/**
 * Default timezone for owner mode (Theresa). Future: read from user profile.
 */
export const OWNER_TIMEZONE = "America/Toronto";

export function getLocalHour(date: Date, timeZone: string = OWNER_TIMEZONE): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number.parseInt(hourPart, 10);
  if (!Number.isFinite(hour)) return 0;
  return hour === 24 ? 0 : hour;
}

export function isAfterLocalHour(
  date: Date,
  hour: number,
  timeZone: string = OWNER_TIMEZONE,
): boolean {
  return getLocalHour(date, timeZone) >= hour;
}
