import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { ApiError } from "./errors";

const VIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_TIMEZONE: string =
  process.env["DEFAULT_TIMEZONE"] ?? "America/Toronto";

/** Resolve the timezone to use. Falls back to env / America/Toronto. */
export function resolveTimezone(timezone: string | null | undefined): string {
  return timezone && timezone.trim() ? timezone : DEFAULT_TIMEZONE;
}

/** Current Date interpreted in the user's timezone (returns a Date whose
 * UTC fields equal the user's local wall-clock time). Useful for
 * calendar arithmetic. */
export function getUserNow(timezone: string): Date {
  const tz = resolveTimezone(timezone);
  return toZonedTime(new Date(), tz);
}

/** Current YYYY-MM-DD in the user's timezone. */
export function getUserToday(timezone: string): string {
  const tz = resolveTimezone(timezone);
  return formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
}

/** ISO week key (e.g. "2026-W17") for the supplied Date in the user's tz. */
export function getWeekKey(date: Date, timezone: string): string {
  const tz = resolveTimezone(timezone);
  const zoned = toZonedTime(date, tz);
  const week = getISOWeek(zoned);
  const year = getISOWeekYear(zoned);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Monday-anchored week start (YYYY-MM-DD) for the supplied YYYY-MM-DD or
 * Date, evaluated in the user's tz. We keep Monday anchoring to match the
 * existing weekly_plans.weekOf semantics. */
export function getWeekStart(
  date: Date | string = new Date(),
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const tz = resolveTimezone(timezone);
  const sourceDate =
    typeof date === "string" ? parseUserDate(date, tz) : date;
  // Compute weekday in the user's tz (1=Mon..7=Sun via ISO).
  const isoDow = Number(formatInTimeZone(sourceDate, tz, "i"));
  const ymd = formatInTimeZone(sourceDate, tz, "yyyy-MM-dd");
  // Subtract (isoDow-1) days from ymd to land on Monday.
  return shiftYmd(ymd, -(isoDow - 1));
}

/** Add N days to a YYYY-MM-DD value (no tz needed — calendar arithmetic). */
export function shiftYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** Convert a YYYY-MM-DD string to a Date representing the start-of-day
 * in the user's tz (returned as a UTC instant). */
export function parseUserDate(ymd: string, timezone: string): Date {
  const tz = resolveTimezone(timezone);
  if (!VIEW_DATE_PATTERN.test(ymd)) {
    throw ApiError.badRequest(
      "Date must be in YYYY-MM-DD format",
    );
  }
  // Construct UTC midnight then shift by the tz offset at that moment.
  // `formatInTimeZone` of the tz-offset string lets us derive the offset.
  const utcGuess = new Date(`${ymd}T00:00:00Z`);
  const offset = formatInTimeZone(utcGuess, tz, "xxx"); // e.g. "-04:00"
  const local = new Date(`${ymd}T00:00:00${offset}`);
  if (isNaN(local.getTime())) {
    throw ApiError.badRequest("Invalid date");
  }
  return local;
}

/** Validate a YYYY-MM-DD viewDate query param. Returns the validated
 * string, or throws ApiError.badRequest. Pass null/undefined through. */
export function validateViewDate(
  raw: unknown,
  paramName = "viewDate",
): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !VIEW_DATE_PATTERN.test(raw)) {
    throw ApiError.badRequest(
      `${paramName} must be a date in YYYY-MM-DD format`,
    );
  }
  // Also reject calendar-impossible dates like 2026-02-31.
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m! - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw ApiError.badRequest(
      `${paramName} is not a valid calendar date`,
    );
  }
  return raw;
}

export const VIEW_DATE_REGEX = VIEW_DATE_PATTERN;

