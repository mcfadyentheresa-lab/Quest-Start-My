import { formatInTimeZone } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "America/Toronto";

export function resolveTimezone(tz?: string | null): string {
  return tz && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
}

export function getUserToday(tz?: string | null): string {
  return formatInTimeZone(new Date(), resolveTimezone(tz), "yyyy-MM-dd");
}

export function shiftDateString(ymd: string, days: number): string {
  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const utc = Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  const shifted = new Date(utc + days * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekKey(date?: Date | string, tz?: string | null): string {
  const zone = resolveTimezone(tz);
  let ymd: string;
  let dayOfWeek: number;
  if (date === undefined) {
    ymd = formatInTimeZone(new Date(), zone, "yyyy-MM-dd");
    dayOfWeek = Number(formatInTimeZone(new Date(), zone, "i"));
  } else if (typeof date === "string") {
    const sourceDate = parseDateStringInZone(date, zone);
    ymd = formatInTimeZone(sourceDate, zone, "yyyy-MM-dd");
    dayOfWeek = Number(formatInTimeZone(sourceDate, zone, "i"));
  } else {
    ymd = formatInTimeZone(date, zone, "yyyy-MM-dd");
    dayOfWeek = Number(formatInTimeZone(date, zone, "i"));
  }
  return shiftDateString(ymd, -(dayOfWeek - 1));
}

export function getWeekEnd(weekStart: string): string {
  return shiftDateString(weekStart, 6);
}

function parseDateStringInZone(ymd: string, tz: string): Date {
  const offsetTag = formatInTimeZone(new Date(`${ymd}T12:00:00Z`), tz, "XXX");
  return new Date(`${ymd}T00:00:00${offsetTag}`);
}
