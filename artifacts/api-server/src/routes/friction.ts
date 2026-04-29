import { Router, type IRouter } from "express";
import { and, lte, ne, eq, desc } from "drizzle-orm";
import { db, tasksTable, areasTable, milestonesTable, progressLogsTable } from "@workspace/db";
import { GetFrictionSignalsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/** First moment of a calendar month, UTC */
function monthStartFromDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

router.get("/dashboard/friction", async (req, res): Promise<void> => {
  const weekOfParam = typeof req.query.weekOf === "string" ? req.query.weekOf : null;
  if (weekOfParam !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOfParam) || isNaN(Date.parse(weekOfParam + "T00:00:00"))) {
      res.status(400).json({ error: "weekOf must be a valid date in YYYY-MM-DD format" });
      return;
    }
  }

  // Anchor: end of the selected week (weekOf + 6 days). Defaults to today.
  let weekEndStr: string;
  let anchorDate: Date;
  if (weekOfParam) {
    anchorDate = new Date(weekOfParam + "T00:00:00");
    const weekEndDate = new Date(weekOfParam + "T00:00:00");
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndStr = weekEndDate.toISOString().slice(0, 10);
  } else {
    anchorDate = new Date();
    weekEndStr = anchorDate.toISOString().slice(0, 10);
  }

  // "14 days ago" relative to the week end
  const fourteenDaysBeforeAnchor = new Date(weekEndStr + "T00:00:00");
  fourteenDaysBeforeAnchor.setDate(fourteenDaysBeforeAnchor.getDate() - 14);
  const fourteenDaysAgo = fourteenDaysBeforeAnchor.toISOString().slice(0, 10);

  // Month start of the selected week
  const monthStart = monthStartFromDate(anchorDate);
  // End of month boundary for task creation filter
  const weekEndTimestamp = new Date(weekEndStr + "T23:59:59.999Z");

  // Fetch base data — filter logs by week end when a past week is selected
  const passedLogsCondition = weekOfParam
    ? and(eq(progressLogsTable.status, "passed"), lte(progressLogsTable.date, weekEndStr))
    : eq(progressLogsTable.status, "passed");

  const allLogsCondition = weekOfParam
    ? lte(progressLogsTable.date, weekEndStr)
    : undefined;

  const [areas, openMilestones, allPassedLogs, allLogs] = await Promise.all([
    db.select().from(areasTable),
    db.select().from(milestonesTable).where(ne(milestonesTable.status, "complete")),
    db.select().from(progressLogsTable).where(passedLogsCondition),
    allLogsCondition
      ? db.select().from(progressLogsTable).where(allLogsCondition).orderBy(desc(progressLogsTable.loggedAt))
      : db.select().from(progressLogsTable).orderBy(desc(progressLogsTable.loggedAt)),
  ]);

  const areaMap = new Map(areas.map(p => [p.id, p]));
  const openMilestoneIds = new Set(openMilestones.map(m => m.id));

  // Build taskId -> areaId map from ALL tasks (no date restriction) for log enrichment
  const allTaskRows = await db.select({
    id: tasksTable.id,
    areaId: tasksTable.areaId,
    milestoneId: tasksTable.milestoneId,
    status: tasksTable.status,
    title: tasksTable.title,
    createdAt: tasksTable.createdAt,
  }).from(tasksTable);

  const taskAreaMap = new Map(allTaskRows.map(t => [t.id, t.areaId]));

  // Tasks created this calendar month — use createdAt (creation timestamp), not date (scheduled date)
  // When a past week is selected, also bound by the week end so we only count tasks created by then.
  const tasksCreatedThisMonth = allTaskRows.filter(t =>
    t.createdAt >= monthStart && t.createdAt <= weekEndTimestamp
  );

  const signals: {
    type: string;
    areaId: number | null;
    areaName: string | null;
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
      const areaId = taskAreaMap.get(taskId) ?? null;
      const area = areaId ? areaMap.get(areaId) : null;
      const sortedDates = Array.from(dates).sort();
      signals.push({
        type: "repeated_pass",
        areaId: areaId ?? null,
        areaName: area?.name ?? null,
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
        areaId: null,
        areaName: null,
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
  // repeated_block: a area's last 2+ progress_logs entries are all
  // blocked. Checks most-recent entries across all time (no window).
  // ─────────────────────────────────────────────────────────────────
  const logsByArea = new Map<number, { statuses: string[]; entries: { date: string; taskTitle: string }[]; mostRecentDate: string | null }>(); // areaId -> statuses/entries/date, newest first
  for (const log of allLogs) {
    const areaId = log.taskId ? (taskAreaMap.get(log.taskId) ?? null) : null;
    if (areaId !== null) {
      if (!logsByArea.has(areaId)) logsByArea.set(areaId, { statuses: [], entries: [], mostRecentDate: null });
      const entry = logsByArea.get(areaId)!;
      entry.statuses.push(log.status);
      entry.entries.push({ date: log.date, taskTitle: log.taskTitle });
      if (entry.mostRecentDate === null) entry.mostRecentDate = log.date;
    }
  }
  for (const [areaId, { statuses, entries, mostRecentDate }] of logsByArea.entries()) {
    if (statuses.length >= 2 && statuses.slice(0, 2).every(s => s === "blocked")) {
      const area = areaMap.get(areaId);
      const blockedEntries = entries.filter(e => {
        const idx = entries.indexOf(e);
        return statuses[idx] === "blocked";
      }).slice(0, 10);
      signals.push({
        type: "repeated_block",
        areaId,
        areaName: area?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `The last 2 logged activities in "${area?.name ?? "this area"}" are all blocked — something may need resolving before continuing.`,
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
      const area = milestone.areaId ? areaMap.get(milestone.areaId) : null;
      const anchorMs = weekEndTimestamp.getTime();
      const daysSince = lastActivity
        ? Math.floor((anchorMs - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const detail = daysSince !== null
        ? `Milestone "${milestone.title}" has had no task activity for ${daysSince} days — review next action or scope.`
        : `Milestone "${milestone.title}" has no task activity on record — add a linked task to make progress.`;
      signals.push({
        type: "stalled_milestone",
        areaId: milestone.areaId ?? null,
        areaName: area?.name ?? null,
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
  // low_completion_ratio: area with 3+ tasks created this calendar
  // month (by createdAt) and a pass/push-to-done ratio > 3:1.
  // Uses createdAt (creation timestamp) per spec, not date (schedule).
  // ─────────────────────────────────────────────────────────────────
  for (const area of areas) {
    const areaMonthTasks = tasksCreatedThisMonth.filter(t => t.areaId === area.id);
    if (areaMonthTasks.length < 3) continue;
    const doneCount = areaMonthTasks.filter(t => t.status === "done").length;
    const deferCount = areaMonthTasks.filter(t => t.status === "passed" || t.status === "pushed").length;
    // Ratio > 3:1: deferCount > 3 * doneCount (guard for doneCount = 0)
    const isHighDefer = doneCount === 0 ? deferCount >= 3 : deferCount > 3 * doneCount;
    if (isHighDefer) {
      const ratio = doneCount > 0 ? `${(deferCount / doneCount).toFixed(1)}:1` : `${deferCount}:0`;
      const mostRecentTaskDate = areaMonthTasks.reduce<string | null>((max, t) => {
        const d = t.createdAt.toISOString().slice(0, 10);
        return max === null || d > max ? d : max;
      }, null);
      signals.push({
        type: "low_completion_ratio",
        areaId: area.id,
        areaName: area.name,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${area.name}" has a pass/push-to-done ratio of ${ratio} this month (${deferCount} deferred vs ${doneCount} done) — tasks may need to be smaller or reprioritised.`,
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
