import { Router, type IRouter } from "express";
import { and, lte, ne, eq, desc } from "drizzle-orm";
import { db, tasksTable, pillarsTable, milestonesTable, progressLogsTable } from "@workspace/db";
import { GetFrictionSignalsResponse } from "@workspace/api-zod";
import { scoped, userIdFrom } from "../lib/scoped";
import {
  getUserToday,
  parseUserDate,
  shiftYmd,
  validateViewDate,
} from "../lib/time";
import { getUserTimezone } from "../lib/user-timezone";

const router: IRouter = Router();

/** First moment of a calendar month, UTC */
function monthStartFromDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

router.get("/dashboard/friction", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const s = scoped(userId);
  const tz = await getUserTimezone(userId);
  const weekOfParam = validateViewDate(req.query.weekOf, "weekOf");

  // Anchor: end of the selected week (weekOf + 6 days). Defaults to today
  // in the user's timezone.
  let weekEndStr: string;
  let anchorDate: Date;
  if (weekOfParam) {
    anchorDate = parseUserDate(weekOfParam, tz);
    weekEndStr = shiftYmd(weekOfParam, 6);
  } else {
    const today = getUserToday(tz);
    anchorDate = parseUserDate(today, tz);
    weekEndStr = today;
  }

  // "14 days ago" relative to the week end
  const fourteenDaysAgo = shiftYmd(weekEndStr, -14);

  // Month start of the selected week
  const monthStart = monthStartFromDate(anchorDate);
  // End of month boundary for task creation filter
  const weekEndTimestamp = new Date(weekEndStr + "T23:59:59.999Z");

  // Fetch base data — filter logs by week end when a past week is selected
  const passedLogsCondition = weekOfParam
    ? and(s.progressLogs.owns, eq(progressLogsTable.status, "passed"), lte(progressLogsTable.date, weekEndStr))
    : and(s.progressLogs.owns, eq(progressLogsTable.status, "passed"));

  const allLogsCondition = weekOfParam
    ? and(s.progressLogs.owns, lte(progressLogsTable.date, weekEndStr))
    : s.progressLogs.owns;

  const [pillars, openMilestones, allPassedLogs, allLogs] = await Promise.all([
    db.select().from(pillarsTable).where(s.pillars.owns),
    db.select().from(milestonesTable).where(and(s.milestones.owns, ne(milestonesTable.status, "complete"))),
    db.select().from(progressLogsTable).where(passedLogsCondition),
    db.select().from(progressLogsTable).where(allLogsCondition).orderBy(desc(progressLogsTable.loggedAt)),
  ]);

  const pillarMap = new Map(pillars.map(p => [p.id, p]));
  const openMilestoneIds = new Set(openMilestones.map(m => m.id));

  // Build taskId -> pillarId map from ALL tasks (no date restriction) for log enrichment
  const allTaskRows = await db.select({
    id: tasksTable.id,
    pillarId: tasksTable.pillarId,
    milestoneId: tasksTable.milestoneId,
    status: tasksTable.status,
    title: tasksTable.title,
    createdAt: tasksTable.createdAt,
  }).from(tasksTable).where(s.tasks.owns);

  const taskPillarMap = new Map(allTaskRows.map(t => [t.id, t.pillarId]));

  // Tasks created this calendar month — use createdAt (creation timestamp), not date (scheduled date)
  // When a past week is selected, also bound by the week end so we only count tasks created by then.
  const tasksCreatedThisMonth = allTaskRows.filter(t =>
    t.createdAt >= monthStart && t.createdAt <= weekEndTimestamp
  );

  const signals: {
    type: string;
    pillarId: number | null;
    pillarName: string | null;
    taskId: number | null;
    taskTitle: string | null;
    milestoneId: number | null;
    milestoneTitle: string | null;
    detail: string;
    lastSeenDate: string | null;
    passDates?: string[];
    blockEntries?: { date: string; taskTitle: string }[];
  }[] = [];

  // ─────────────────────────────────────────────────────────────────
  // repeated_pass: same task identity in progress_logs with status
  // "passed" on 2+ distinct dates.
  // Primary key: taskId (not null); fallback: taskTitle for null-id logs.
  // No time window — spec does not restrict to any window.
  // ─────────────────────────────────────────────────────────────────
  const passedByTaskId = new Map<number, { dates: Set<string>; taskTitle: string; maxDate: string }>();
  const passedByTitleNullId = new Map<string, { dates: Set<string>; maxDate: string }>();

  for (const log of allPassedLogs) {
    if (log.taskId !== null) {
      if (!passedByTaskId.has(log.taskId)) {
        passedByTaskId.set(log.taskId, { dates: new Set(), taskTitle: log.taskTitle, maxDate: log.date });
      }
      const entry = passedByTaskId.get(log.taskId)!;
      entry.dates.add(log.date);
      if (log.date > entry.maxDate) entry.maxDate = log.date;
    } else {
      if (!passedByTitleNullId.has(log.taskTitle)) passedByTitleNullId.set(log.taskTitle, { dates: new Set(), maxDate: log.date });
      const entry = passedByTitleNullId.get(log.taskTitle)!;
      entry.dates.add(log.date);
      if (log.date > entry.maxDate) entry.maxDate = log.date;
    }
  }
  for (const [taskId, { dates, taskTitle, maxDate }] of passedByTaskId.entries()) {
    if (dates.size >= 2) {
      const pillarId = taskPillarMap.get(taskId) ?? null;
      const pillar = pillarId ? pillarMap.get(pillarId) : null;
      const sortedDates = Array.from(dates).sort();
      signals.push({
        type: "repeated_pass",
        pillarId: pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been passed (deferred) on ${dates.size} separate days — consider tackling it directly or dropping it.`,
        lastSeenDate: maxDate,
        passDates: sortedDates,
      });
    }
  }
  for (const [taskTitle, { dates, maxDate }] of passedByTitleNullId.entries()) {
    if (dates.size >= 2) {
      const sortedDates = Array.from(dates).sort();
      signals.push({
        type: "repeated_pass",
        pillarId: null,
        pillarName: null,
        taskId: null,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been passed (deferred) on ${dates.size} separate days — consider tackling it directly or dropping it.`,
        lastSeenDate: maxDate,
        passDates: sortedDates,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // repeated_block: a pillar's last 2+ progress_logs entries are all
  // blocked. Checks most-recent entries across all time (no window).
  // ─────────────────────────────────────────────────────────────────
  const logsByPillar = new Map<number, { statuses: string[]; entries: { date: string; taskTitle: string }[]; mostRecentDate: string | null }>(); // pillarId -> statuses/entries/date, newest first
  for (const log of allLogs) {
    const pillarId = log.taskId ? (taskPillarMap.get(log.taskId) ?? null) : null;
    if (pillarId !== null) {
      if (!logsByPillar.has(pillarId)) logsByPillar.set(pillarId, { statuses: [], entries: [], mostRecentDate: null });
      const entry = logsByPillar.get(pillarId)!;
      entry.statuses.push(log.status);
      entry.entries.push({ date: log.date, taskTitle: log.taskTitle });
      if (entry.mostRecentDate === null) entry.mostRecentDate = log.date;
    }
  }
  for (const [pillarId, { statuses, entries, mostRecentDate }] of logsByPillar.entries()) {
    if (statuses.length >= 2 && statuses.slice(0, 2).every(s => s === "blocked")) {
      const pillar = pillarMap.get(pillarId);
      const blockedEntries = entries.filter(e => {
        const idx = entries.indexOf(e);
        return statuses[idx] === "blocked";
      }).slice(0, 10);
      signals.push({
        type: "repeated_block",
        pillarId,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `The last 2 logged activities in "${pillar?.name ?? "this pillar"}" are all blocked — something may need resolving before continuing.`,
        lastSeenDate: mostRecentDate,
        blockEntries: blockedEntries,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // stalled_milestone: non-complete milestone with no linked task
  // activity in progress_logs for 14+ days. No task-date cutoff.
  // ─────────────────────────────────────────────────────────────────
  // Find ALL tasks (no date restriction) linked to open milestones
  const milestoneTaskIds = new Set(
    allTaskRows.filter(t => t.milestoneId !== null && openMilestoneIds.has(t.milestoneId!)).map(t => t.id)
  );
  // Map milestone -> latest progress_log date from linked tasks
  const milestoneLogs = allLogs.filter(l => l.taskId !== null && milestoneTaskIds.has(l.taskId!));
  const lastActivityByMilestone = new Map<number, string>();
  for (const log of milestoneLogs) {
    if (!log.taskId) continue;
    const task = allTaskRows.find(t => t.id === log.taskId);
    if (!task?.milestoneId) continue;
    const logDate = log.date;
    const current = lastActivityByMilestone.get(task.milestoneId);
    if (!current || logDate > current) lastActivityByMilestone.set(task.milestoneId, logDate);
  }
  for (const milestone of openMilestones) {
    const lastActivity = lastActivityByMilestone.get(milestone.id);
    const isStalled = !lastActivity || lastActivity < fourteenDaysAgo;
    if (isStalled) {
      const pillar = milestone.pillarId ? pillarMap.get(milestone.pillarId) : null;
      const anchorMs = weekEndTimestamp.getTime();
      const daysSince = lastActivity
        ? Math.floor((anchorMs - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const detail = daysSince !== null
        ? `Milestone "${milestone.title}" has had no task activity for ${daysSince} days — review next action or scope.`
        : `Milestone "${milestone.title}" has no task activity on record — add a linked task to make progress.`;
      signals.push({
        type: "stalled_milestone",
        pillarId: milestone.pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        detail,
        lastSeenDate: lastActivity ?? null,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // low_completion_ratio: pillar with 3+ tasks created this calendar
  // month (by createdAt) and a pass/push-to-done ratio > 3:1.
  // Uses createdAt (creation timestamp) per spec, not date (schedule).
  // ─────────────────────────────────────────────────────────────────
  for (const pillar of pillars) {
    const pillarMonthTasks = tasksCreatedThisMonth.filter(t => t.pillarId === pillar.id);
    if (pillarMonthTasks.length < 3) continue;
    const doneCount = pillarMonthTasks.filter(t => t.status === "done").length;
    const deferCount = pillarMonthTasks.filter(t => t.status === "passed" || t.status === "pushed").length;
    // Ratio > 3:1: deferCount > 3 * doneCount (guard for doneCount = 0)
    const isHighDefer = doneCount === 0 ? deferCount >= 3 : deferCount > 3 * doneCount;
    if (isHighDefer) {
      const ratio = doneCount > 0 ? `${(deferCount / doneCount).toFixed(1)}:1` : `${deferCount}:0`;
      const mostRecentTaskDate = pillarMonthTasks.reduce<string | null>((max, t) => {
        const d = t.createdAt.toISOString().slice(0, 10);
        return max === null || d > max ? d : max;
      }, null);
      signals.push({
        type: "low_completion_ratio",
        pillarId: pillar.id,
        pillarName: pillar.name,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${pillar.name}" has a pass/push-to-done ratio of ${ratio} this month (${deferCount} deferred vs ${doneCount} done) — tasks may need to be smaller or reprioritised.`,
        lastSeenDate: mostRecentTaskDate,
      });
    }
  }

  const parsed = GetFrictionSignalsResponse.parse(signals);
  res.json(
    parsed.map((s) => ({
      ...s,
      lastSeenDate:
        s.lastSeenDate instanceof Date
          ? s.lastSeenDate.toISOString().slice(0, 10)
          : (s.lastSeenDate ?? null),
    })),
  );
});

export default router;
