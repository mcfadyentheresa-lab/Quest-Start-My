import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { z } from "zod";
import { ApiError } from "./errors";

export const DEFAULT_TIMEZONE = "America/Toronto";

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export type DateString = `${number}-${number}-${number}`;

export function resolveTimezone(tz?: string | null): string {
  return tz && tz.length > 0 ? tz : DEFAULT_TIMEZONE;
}

export function getUserNow(tz?: string | null): Date {
  return toZonedTime(new Date(), resolveTimezone(tz));
}

export function getUserToday(tz?: string | null): string {
  return formatInTimeZone(new Date(), resolveTimezone(tz), "yyyy-MM-dd");
}

export function getWeekKey(date: Date | string, tz?: string | null): string {
  const zone = resolveTimezone(tz);
  const sourceDate =
    typeof date === "string"
      ? parseDateStringInZone(date, zone)
      : date;
  const ymd = formatInTimeZone(sourceDate, zone, "yyyy-MM-dd");
  const dayOfWeek = Number(formatInTimeZone(sourceDate, zone, "i"));
  const offset = dayOfWeek - 1;
  return shiftDateString(ymd, -offset);
}

function isRealCalendarDate(ymd: string): boolean {
  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utcMs = Date.UTC(year, month - 1, day);
  const d = new Date(utcMs);
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

function validateDateShape(raw: unknown): string | null {
  const parsed = dateStringSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (!isRealCalendarDate(parsed.data)) return null;
  return parsed.data;
}

export function parseViewDate(raw: unknown): string {
  const valid = validateDateShape(raw);
  if (valid === null) {
    throw ApiError.badRequest("viewDate must be a valid YYYY-MM-DD calendar date");
  }
  return valid;
}

export function parseDateString(raw: unknown, fieldName = "date"): string {
  const valid = validateDateShape(raw);
  if (valid === null) {
    throw ApiError.badRequest(`${fieldName} must be a valid YYYY-MM-DD calendar date`);
  }
  return valid;
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

export function getWeekEnd(weekStart: string): string {
  return shiftDateString(weekStart, 6);
}

function parseDateStringInZone(ymd: string, tz: string): Date {
  const offsetTag = formatInTimeZone(new Date(`${ymd}T12:00:00Z`), tz, "XXX");
  return new Date(`${ymd}T00:00:00${offsetTag}`);
}
