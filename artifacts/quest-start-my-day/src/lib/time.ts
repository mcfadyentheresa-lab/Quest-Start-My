import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const VIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Browser's resolved IANA timezone, falling back to America/Toronto so the
 * UI matches the api-server default when the platform can't tell us. */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  } catch {
    return "America/Toronto";
  }
}

/** Current YYYY-MM-DD in the user's local timezone. */
export function getUserToday(timezone: string = getBrowserTimezone()): string {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

/** Monday-anchored week start (YYYY-MM-DD) in the user's tz. Defaults to
 * "this week" but accepts an arbitrary anchor YYYY-MM-DD or Date. */
export function getWeekStart(
  date: Date | string = new Date(),
  timezone: string = getBrowserTimezone(),
): string {
  const sourceDate =
    typeof date === "string" ? parseUserDate(date, timezone) : date;
  const isoDow = Number(formatInTimeZone(sourceDate, timezone, "i"));
  const ymd = formatInTimeZone(sourceDate, timezone, "yyyy-MM-dd");
  return shiftYmd(ymd, -(isoDow - 1));
}

/** Add `delta` days to a YYYY-MM-DD string. Calendar arithmetic — tz-free. */
export function shiftYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Convert a YYYY-MM-DD into a UTC instant representing local midnight in
 * the user's tz. Used for stable Date math (e.g. day-of-week). */
export function parseUserDate(ymd: string, timezone: string = getBrowserTimezone()): Date {
  if (!VIEW_DATE_PATTERN.test(ymd)) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const utcGuess = new Date(`${ymd}T00:00:00Z`);
  const offset = formatInTimeZone(utcGuess, timezone, "xxx");
  return new Date(`${ymd}T00:00:00${offset}`);
}

/** Same instant, returned as a Date carrying the user's wall-clock fields. */
export function toUserZoned(date: Date, timezone: string = getBrowserTimezone()): Date {
  return toZonedTime(date, timezone);
}

export const VIEW_DATE_REGEX = VIEW_DATE_PATTERN;
