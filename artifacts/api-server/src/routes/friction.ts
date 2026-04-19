import { Router, type IRouter } from "express";
import { and, gte, ne, eq, desc } from "drizzle-orm";
import { db, tasksTable, pillarsTable, milestonesTable, progressLogsTable } from "@workspace/db";
import { GetFrictionSignalsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getMonthStart(): string {
  return new Date().toISOString().slice(0, 7) + "-01";
}

router.get("/dashboard/friction", async (req, res): Promise<void> => {
  const fourteenDaysAgo = daysAgo(14);
  const monthStart = getMonthStart();

  // Fetch all data needed — no arbitrary time windows on repeated_pass / repeated_block
  const [pillars, openMilestones, allPassedLogs, allLogs, allTasksThisMonth] = await Promise.all([
    db.select().from(pillarsTable),
    db.select().from(milestonesTable).where(ne(milestonesTable.status, "complete")),
    // All-time passed logs (repeated_pass has no specified time window)
    db.select().from(progressLogsTable).where(eq(progressLogsTable.status, "passed")),
    // All-time logs ordered newest-first (for repeated_block per-pillar most-recent check)
    db.select().from(progressLogsTable).orderBy(desc(progressLogsTable.loggedAt)),
    // Tasks this calendar month (for low_completion_ratio)
    db.select().from(tasksTable).where(gte(tasksTable.date, monthStart)),
  ]);

  const pillarMap = new Map(pillars.map(p => [p.id, p]));

  // Build taskId -> pillarId from all tasks that appear in logs
  const allLogTaskIds = new Set(allLogs.filter(l => l.taskId !== null).map(l => l.taskId!));
  const taskRows = allLogTaskIds.size > 0
    ? await db.select({ id: tasksTable.id, pillarId: tasksTable.pillarId })
        .from(tasksTable)
    : [];
  const taskPillarMap = new Map(taskRows.map(t => [t.id, t.pillarId]));

  // Also include this month's tasks in the map
  for (const t of allTasksThisMonth) taskPillarMap.set(t.id, t.pillarId);

  // Milestone tasks for stalled_milestone detection
  const openMilestoneIds = new Set(openMilestones.map(m => m.id));
  const milestoneTasks = await db.select({
    id: tasksTable.id,
    milestoneId: tasksTable.milestoneId,
    pillarId: tasksTable.pillarId,
  }).from(tasksTable).where(gte(tasksTable.date, daysAgo(90)));

  const signals: {
    type: string;
    pillarId: number | null;
    pillarName: string | null;
    taskId: number | null;
    taskTitle: string | null;
    milestoneId: number | null;
    milestoneTitle: string | null;
    detail: string;
  }[] = [];

  // ─────────────────────────────────────────────────────────────────
  // repeated_pass: same task identity appears in progress_logs with
  // status "passed" on 2+ distinct dates.
  // Primary key: taskId (where not null); fallback: taskTitle (for
  // null-taskId logs only, to avoid merging different tasks by title).
  // ─────────────────────────────────────────────────────────────────
  const passedByTaskId = new Map<number, { dates: Set<string>; taskTitle: string; taskId: number }>();
  const passedByTitleNullId = new Map<string, { dates: Set<string> }>();
  for (const log of allPassedLogs) {
    if (log.taskId !== null) {
      if (!passedByTaskId.has(log.taskId)) {
        passedByTaskId.set(log.taskId, { dates: new Set(), taskTitle: log.taskTitle, taskId: log.taskId });
      }
      passedByTaskId.get(log.taskId)!.dates.add(log.date);
    } else {
      if (!passedByTitleNullId.has(log.taskTitle)) passedByTitleNullId.set(log.taskTitle, { dates: new Set() });
      passedByTitleNullId.get(log.taskTitle)!.dates.add(log.date);
    }
  }
  // Emit signals for taskId-keyed matches
  for (const [taskId, { dates, taskTitle }] of passedByTaskId.entries()) {
    if (dates.size >= 2) {
      const pillarId = taskPillarMap.get(taskId) ?? null;
      const pillar = pillarId ? pillarMap.get(pillarId) : null;
      signals.push({
        type: "repeated_pass",
        pillarId: pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been passed (deferred) on ${dates.size} separate days — consider tackling it directly or dropping it.`,
      });
    }
  }
  // Emit signals for title-keyed (null taskId) matches
  for (const [taskTitle, { dates }] of passedByTitleNullId.entries()) {
    if (dates.size >= 2) {
      signals.push({
        type: "repeated_pass",
        pillarId: null,
        pillarName: null,
        taskId: null,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been passed (deferred) on ${dates.size} separate days — consider tackling it directly or dropping it.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // repeated_block: a pillar's last 2+ progress_logs entries are all
  // blocked. Checks most-recent entries across all time (no window).
  // ─────────────────────────────────────────────────────────────────
  const logsByPillar = new Map<number, string[]>(); // pillarId -> statuses (newest first)
  for (const log of allLogs) {
    const pillarId = log.taskId ? (taskPillarMap.get(log.taskId) ?? null) : null;
    if (pillarId !== null) {
      if (!logsByPillar.has(pillarId)) logsByPillar.set(pillarId, []);
      logsByPillar.get(pillarId)!.push(log.status);
    }
  }
  for (const [pillarId, statuses] of logsByPillar.entries()) {
    if (statuses.length >= 2 && statuses.slice(0, 2).every(s => s === "blocked")) {
      const pillar = pillarMap.get(pillarId);
      signals.push({
        type: "repeated_block",
        pillarId,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `The last ${statuses.slice(0, 2).length} logged activities in "${pillar?.name ?? "this pillar"}" are all blocked — something may need resolving before continuing.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // stalled_milestone: non-complete milestone with no linked task
  // activity in progress_logs for 14+ days. (14-day window is spec.)
  // ─────────────────────────────────────────────────────────────────
  const milestoneTaskIds = new Set(
    milestoneTasks.filter(t => t.milestoneId && openMilestoneIds.has(t.milestoneId)).map(t => t.id)
  );
  const milestoneLogs = allLogs.filter(l => l.taskId !== null && milestoneTaskIds.has(l.taskId!));
  const lastActivityByMilestone = new Map<number, string>();
  for (const log of milestoneLogs) {
    if (!log.taskId) continue;
    const task = milestoneTasks.find(t => t.id === log.taskId);
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
      const daysSince = lastActivity
        ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
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
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // low_completion_ratio: pillar with 3+ tasks this calendar month
  // and a pass/push-to-done ratio above 3:1. (Spec-defined window.)
  // ─────────────────────────────────────────────────────────────────
  for (const pillar of pillars) {
    const pillarMonthTasks = allTasksThisMonth.filter(t => t.pillarId === pillar.id);
    if (pillarMonthTasks.length < 3) continue;
    const doneCount = pillarMonthTasks.filter(t => t.status === "done").length;
    const deferCount = pillarMonthTasks.filter(t => t.status === "passed" || t.status === "pushed").length;
    // Ratio > 3:1 means deferCount > 3 * doneCount; guard doneCount=0
    const isHighDefer = doneCount === 0 ? deferCount >= 3 : deferCount > 3 * doneCount;
    if (isHighDefer) {
      const ratio = doneCount > 0 ? `${(deferCount / doneCount).toFixed(1)}:1` : `${deferCount}:0`;
      signals.push({
        type: "low_completion_ratio",
        pillarId: pillar.id,
        pillarName: pillar.name,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${pillar.name}" has a pass/push-to-done ratio of ${ratio} this month (${deferCount} deferred vs ${doneCount} done) — tasks may need to be smaller or reprioritised.`,
      });
    }
  }

  res.json(GetFrictionSignalsResponse.parse(signals));
});

export default router;
