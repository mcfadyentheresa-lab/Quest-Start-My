// Pure cadence logic for recurring task templates. No DB imports — kept
// separate from `recurring-materialize.ts` so it can be unit-tested without
// requiring a DATABASE_URL.
//
// Shape mirrors the recurring_tasks table row, but only the fields the
// cadence rule needs are referenced. Extra fields are ignored.

export type RecurringCadenceInput = {
  frequency: string;
  weekdays: string | null;
  dayOfMonth: number | null;
  startDate: string;
  pausedAt: Date | null;
};

function parseWeekdays(stored: string | null): number[] | null {
  if (stored == null || stored === "") return null;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {
    // ignore
  }
  return null;
}

export function clampDayOfMonth(year: number, month0: number, day: number): number {
  // month0 is 0-indexed (0=Jan). Day 0 of next month = last day of this month.
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

// True if today's calendar date matches the template's cadence. UTC math
// keeps the answer deterministic across server timezones.
export function isDueOn(template: RecurringCadenceInput, todayIso: string): boolean {
  if (template.startDate > todayIso) return false;
  if (template.pausedAt) return false;

  const [yStr, mStr, dStr] = todayIso.split("-");
  const year = Number(yStr);
  const month0 = Number(mStr) - 1;
  const day = Number(dStr);
  if (!Number.isFinite(year) || !Number.isFinite(month0) || !Number.isFinite(day)) {
    return false;
  }

  switch (template.frequency) {
    case "daily":
      return true;
    case "weekly": {
      const weekdays = parseWeekdays(template.weekdays);
      if (!weekdays || weekdays.length === 0) return false;
      const wd = new Date(Date.UTC(year, month0, day)).getUTCDay(); // 0=Sun..6=Sat
      return weekdays.includes(wd);
    }
    case "monthly": {
      if (template.dayOfMonth == null) return false;
      const target = clampDayOfMonth(year, month0, template.dayOfMonth);
      return day === target;
    }
    default:
      return false;
  }
}
