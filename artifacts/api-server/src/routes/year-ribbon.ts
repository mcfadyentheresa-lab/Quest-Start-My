import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, tasksTable, areasTable, milestonesTable, progressLogsTable } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { getUserId } from "../lib/auth";

const router: IRouter = Router();

const WEEKS_PER_YEAR = 52;
const CACHE_TTL_MS = 5 * 60 * 1000;

type WeekBucket = {
  index: number;
  completedTasks: number;
  createdTasks: number;
  closedSteps: number;
};

type GoalBar = {
  goalId: number;
  title: string;
  startWeek: number;
  endWeek: number;
  status: string;
  isOnHold: boolean;
  /** ISO date (YYYY-MM-DD) of the goal's target_date, if set. Drives the
   *  pill's anchor month in the year view; the year view falls back to
   *  task-derived span when null. */
  targetDate: string | null;
  /** Which week (0..51) the targetDate lands in. Null when targetDate is
   *  null or falls outside the requested year. */
  targetWeek: number | null;
};

type AreaPayload = {
  id: number;
  name: string;
  priority: string;
  color: string | null;
  category: string | null;
  weeks: WeekBucket[];
  goalBars: GoalBar[];
};

type YearRibbonPayload = {
  year: number;
  weeks: number;
  todayWeekIndex: number | null;
  areas: AreaPayload[];
};

const cache = new Map<string, { expiresAt: number; payload: YearRibbonPayload }>();

function cacheKey(year: number, userId: string): string {
  return `year:${userId}:${year}`;
}

function getFromCache(key: string): YearRibbonPayload | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

function setCache(key: string, payload: YearRibbonPayload): void {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

export function clearYearRibbonCache(): void {
  cache.clear();
}

/** Invalidate all cached year payloads for one user. Call this whenever a
 *  mutation could move or hide a goal pill (e.g. milestone targetDate /
 *  status change, milestone delete, task close/move that shifts a span). */
export function invalidateYearRibbonForUser(userId: string): void {
  const prefix = `year:${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Day-of-year (0-based) for a YYYY-MM-DD ISO date. Returns null if the
// date string is malformed or not in the requested year.
function dayOfYear(dateIso: string, year: number): number | null {
  if (typeof dateIso !== "string" || dateIso.length < 10) return null;
  const y = Number(dateIso.slice(0, 4));
  const m = Number(dateIso.slice(5, 7));
  const d = Number(dateIso.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y !== year) return null;
  const start = Date.UTC(year, 0, 1);
  const here = Date.UTC(y, m - 1, d);
  return Math.floor((here - start) / 86_400_000);
}

// Week index 0..51 for a date in the given year. Days past week 51 (the
// last few days of long years) are clamped into week 51 so the ribbon
// always has exactly 52 cells.
function weekIndex(dateIso: string, year: number): number | null {
  const doy = dayOfYear(dateIso, year);
  if (doy === null) return null;
  const idx = Math.floor(doy / 7);
  if (idx < 0) return null;
  return Math.min(idx, WEEKS_PER_YEAR - 1);
}

function todayWeekIndexFor(year: number): number | null {
  const now = new Date();
  const todayYear = now.getUTCFullYear();
  if (todayYear !== year) return null;
  const todayIso = now.toISOString().slice(0, 10);
  return weekIndex(todayIso, year);
}

function emptyWeeks(): WeekBucket[] {
  const out: WeekBucket[] = [];
  for (let i = 0; i < WEEKS_PER_YEAR; i++) {
    out.push({ index: i, completedTasks: 0, createdTasks: 0, closedSteps: 0 });
  }
  return out;
}

function parseYear(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = Number(raw);
  if (!Number.isInteger(n)) return null;
  if (n < 1970 || n > 9999) return null;
  return n;
}

router.get("/year-ribbon", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const yearParam = req.query.year;
  const year = yearParam !== undefined ? parseYear(yearParam) : new Date().getUTCFullYear();
  if (year === null) {
    res.status(400).json({ error: "Invalid year" });
    return;
  }

  const cached = getFromCache(cacheKey(year, userId));
  if (cached) {
    res.setHeader("X-Year-Ribbon-Cache", "hit");
    res.json(cached);
    return;
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [areas, tasks, milestones, progressLogs] = await Promise.all([
    db.select().from(areasTable).where(eq(areasTable.userId, userId)).orderBy(areasTable.id),
    db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.userId, userId), gte(tasksTable.date, yearStart), lte(tasksTable.date, yearEnd))),
    db.select().from(milestonesTable).where(eq(milestonesTable.userId, userId)),
    db
      .select()
      .from(progressLogsTable)
      .where(and(eq(progressLogsTable.userId, userId), gte(progressLogsTable.date, yearStart), lte(progressLogsTable.date, yearEnd))),
  ]);

  // Map task id -> areaId for log attribution. Logs are kept even if the
  // task row is deleted later, so a missing entry just means "no area".
  const taskAreaById = new Map<number, number | null>();
  const taskMilestoneById = new Map<number, number | null>();
  for (const t of tasks) {
    taskAreaById.set(t.id, t.areaId ?? null);
    taskMilestoneById.set(t.id, t.milestoneId ?? null);
  }

  const areasById = new Map<number, typeof areas[number]>();
  for (const a of areas) areasById.set(a.id, a);

  const milestonesById = new Map<number, typeof milestones[number]>();
  for (const m of milestones) milestonesById.set(m.id, m);

  // Per-area, per-week buckets.
  const buckets = new Map<number, WeekBucket[]>();
  function ensureBuckets(areaId: number): WeekBucket[] {
    let arr = buckets.get(areaId);
    if (!arr) {
      arr = emptyWeeks();
      buckets.set(areaId, arr);
    }
    return arr;
  }

  // Created-tasks: bucket by tasks.date (when the task was scheduled for).
  for (const t of tasks) {
    if (t.areaId === null || t.areaId === undefined) continue;
    if (!areasById.has(t.areaId)) continue;
    if (t.date == null) continue;
    const idx = weekIndex(t.date, year);
    if (idx === null) continue;
    const arr = ensureBuckets(t.areaId);
    arr[idx]!.createdTasks += 1;
  }

  // Completed-tasks + closed-steps: drive from progress_logs so we count
  // the actual closure event, not just current status. A task can flip
  // between done/pending across a week — the log preserves each event.
  for (const log of progressLogs) {
    if (log.status !== "done") continue;
    const areaId = log.taskId !== null && log.taskId !== undefined
      ? taskAreaById.get(log.taskId) ?? null
      : null;
    if (areaId === null || !areasById.has(areaId)) continue;
    const idx = weekIndex(log.date, year);
    if (idx === null) continue;
    const arr = ensureBuckets(areaId);
    arr[idx]!.completedTasks += 1;
    const milestoneId = log.taskId !== null && log.taskId !== undefined
       ? taskMilestoneById.get(log.taskId) ?? null
       : null;
    if (milestoneId !== null) {
      arr[idx]!.closedSteps += 1;
    }
  }

  // Goal bars: for each milestone with either (a) a targetDate in this
  // year, or (b) at least one task/closure in this year, render a pill.
  // The pill's start/end week is the targetDate's week when set; otherwise
  // it spans where its tasks live. Goals with neither are skipped.
  const milestoneSpans = new Map<number, { min: number; max: number }>();
  function recordSpan(milestoneId: number | null, idx: number) {
    if (milestoneId === null) return;
    const cur = milestoneSpans.get(milestoneId);
    if (!cur) {
      milestoneSpans.set(milestoneId, { min: idx, max: idx });
    } else {
      if (idx < cur.min) cur.min = idx;
      if (idx > cur.max) cur.max = idx;
    }
  }
  for (const t of tasks) {
    if (t.milestoneId === null || t.milestoneId === undefined) continue;
    if (t.date == null) continue;
    const idx = weekIndex(t.date, year);
    if (idx === null) continue;
    recordSpan(t.milestoneId, idx);
  }
  for (const log of progressLogs) {
    if (log.taskId === null || log.taskId === undefined) continue;
    const milestoneId = taskMilestoneById.get(log.taskId);
    if (milestoneId === null || milestoneId === undefined) continue;
    const idx = weekIndex(log.date, year);
    if (idx === null) continue;
    recordSpan(milestoneId, idx);
  }

  // Build the union of milestones that should appear: any with a span,
  // OR any whose targetDate falls in this year.
  const goalIdsToShow = new Set<number>(milestoneSpans.keys());
  for (const m of milestones) {
    if (!m.targetDate) continue;
    const tw = weekIndex(m.targetDate, year);
    if (tw !== null) goalIdsToShow.add(m.id);
  }

  const goalBarsByArea = new Map<number, GoalBar[]>();
  for (const milestoneId of goalIdsToShow) {
    const milestone = milestonesById.get(milestoneId);
    if (!milestone) continue;
    if (!areasById.has(milestone.areaId)) continue;
    const span = milestoneSpans.get(milestoneId) ?? null;
    const targetWeek = milestone.targetDate ? weekIndex(milestone.targetDate, year) : null;

    // Position rule: targetDate wins when present in this year. Otherwise
    // span the task activity. (One of the two is guaranteed by the
    // goalIdsToShow construction above.)
    let startWeek: number;
    let endWeek: number;
    if (targetWeek !== null) {
      startWeek = targetWeek;
      endWeek = targetWeek;
    } else if (span !== null) {
      startWeek = span.min;
      endWeek = span.max;
    } else {
      continue;
    }

    const bar: GoalBar = {
      goalId: milestone.id,
      title: milestone.title,
      startWeek,
      endWeek,
      status: milestone.status,
      isOnHold: milestone.holdUntilMilestoneId !== null && milestone.holdUntilMilestoneId !== undefined,
      targetDate: milestone.targetDate ?? null,
      targetWeek,
    };
    let arr = goalBarsByArea.get(milestone.areaId);
    if (!arr) {
      arr = [];
      goalBarsByArea.set(milestone.areaId, arr);
    }
    arr.push(bar);
  }

  // Show active areas first; within each band, P1 → P4, then by id.
  const priorityRank: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
  const sortedAreas = [...areas].sort((a, b) => {
    const aActive = a.isActiveThisWeek ? 0 : 1;
    const bActive = b.isActiveThisWeek ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aRank = priorityRank[a.priority] ?? 99;
    const bRank = priorityRank[b.priority] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return a.id - b.id;
  });

  const payload: YearRibbonPayload = {
    year,
    weeks: WEEKS_PER_YEAR,
    todayWeekIndex: todayWeekIndexFor(year),
    areas: sortedAreas.map((a) => ({
      id: a.id,
      name: a.name,
      priority: a.priority,
      color: a.color ?? null,
      category: a.category ?? null,
      weeks: buckets.get(a.id) ?? emptyWeeks(),
      goalBars: (goalBarsByArea.get(a.id) ?? []).sort((x, y) => x.startWeek - y.startWeek || x.goalId - y.goalId),
    })),
  };

  setCache(cacheKey(year, userId), payload);
  res.setHeader("X-Year-Ribbon-Cache", "miss");
  res.json(payload);
}));

export default router;
