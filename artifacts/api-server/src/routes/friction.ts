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
  const thirtyDaysAgo = daysAgo(30);
  const monthStart = getMonthStart();
  const today = new Date().toISOString().slice(0, 10);

  const [pillars, allMilestones, recentPassedLogs, allTasksThisMonth, allBlockedLogs] = await Promise.all([
    db.select().from(pillarsTable),
    db.select().from(milestonesTable).where(ne(milestonesTable.status, "complete")),
    // passed logs in last 30 days (for repeated_pass)
    db.select().from(progressLogsTable).where(
      and(eq(progressLogsTable.status, "passed"), gte(progressLogsTable.date, thirtyDaysAgo))
    ),
    // tasks created this month (for low_completion_ratio)
    db.select().from(tasksTable).where(gte(tasksTable.date, monthStart)),
    // ALL recent blocked logs in last 14 days (for repeated_block)
    db.select().from(progressLogsTable).where(
      and(eq(progressLogsTable.status, "blocked"), gte(progressLogsTable.date, fourteenDaysAgo))
    ),
  ]);

  const pillarMap = new Map(pillars.map(p => [p.id, p]));

  // Build task->pillar lookup from this month's tasks
  const taskPillarMap = new Map(allTasksThisMonth.map(t => [t.id, t.pillarId]));

  // Fetch all progress logs per milestone's linked tasks for stalled_milestone check
  // We need logs for tasks linked to open milestones
  const openMilestoneIds = new Set(allMilestones.map(m => m.id));
  const milestoneTasks = await db.select({
    id: tasksTable.id,
    milestoneId: tasksTable.milestoneId,
    pillarId: tasksTable.pillarId,
  }).from(tasksTable).where(gte(tasksTable.date, daysAgo(90))); // look back 90 days for milestone tasks

  // Also get progress_logs for all recent tasks (for repeated_block per pillar)
  const recentAllLogs = await db.select().from(progressLogsTable)
    .where(gte(progressLogsTable.date, fourteenDaysAgo))
    .orderBy(desc(progressLogsTable.loggedAt));

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

  // --- repeated_pass: same taskTitle appears in progress_logs with status "passed" on 2+ distinct dates ---
  const passedByTitle = new Map<string, Set<string>>();
  for (const log of recentPassedLogs) {
    if (!passedByTitle.has(log.taskTitle)) passedByTitle.set(log.taskTitle, new Set());
    passedByTitle.get(log.taskTitle)!.add(log.date);
  }
  for (const [taskTitle, dates] of passedByTitle.entries()) {
    if (dates.size >= 2) {
      // Find a recent log entry for this task to get pillarId
      const sampleLog = recentPassedLogs.find(l => l.taskTitle === taskTitle);
      const pillarId = sampleLog?.taskId ? taskPillarMap.get(sampleLog.taskId) ?? null : null;
      const pillar = pillarId ? pillarMap.get(pillarId) : null;
      signals.push({
        type: "repeated_pass",
        pillarId: pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId: sampleLog?.taskId ?? null,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been passed (deferred) on ${dates.size} separate days — consider tackling it directly or dropping it.`,
      });
    }
  }

  // --- repeated_block: a pillar's last 2+ progress_logs entries are all "blocked" ---
  // Build per-pillar log list (using taskId -> pillarId mapping from all recent logs)
  const allTaskIds = new Set(recentAllLogs.filter(l => l.taskId !== null).map(l => l.taskId!));
  // Build a full taskId->pillarId map from the DB for all relevant task IDs
  const taskPillarFull = new Map<number, number | null>(allTasksThisMonth.map(t => [t.id, t.pillarId]));
  // Also fetch tasks from earlier dates that appear in logs
  const extraTaskIds = [...allTaskIds].filter(id => !taskPillarFull.has(id));
  if (extraTaskIds.length > 0) {
    const extraTasks = await db.select({ id: tasksTable.id, pillarId: tasksTable.pillarId })
      .from(tasksTable)
      .where(gte(tasksTable.date, daysAgo(90)));
    for (const t of extraTasks) taskPillarFull.set(t.id, t.pillarId);
  }

  const logsByPillar = new Map<number, { status: string; loggedAt: Date }[]>();
  for (const log of recentAllLogs) {
    const pillarId = log.taskId ? taskPillarFull.get(log.taskId) ?? null : null;
    if (pillarId !== null) {
      if (!logsByPillar.has(pillarId)) logsByPillar.set(pillarId, []);
      logsByPillar.get(pillarId)!.push({ status: log.status, loggedAt: log.loggedAt });
    }
  }
  for (const [pillarId, logs] of logsByPillar.entries()) {
    // logs are already desc by loggedAt
    if (logs.length >= 2 && logs.slice(0, 2).every(l => l.status === "blocked")) {
      const pillar = pillarMap.get(pillarId);
      signals.push({
        type: "repeated_block",
        pillarId,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `Last ${logs.slice(0, 2).length} logged activities in "${pillar?.name ?? "this pillar"}" are all blocked — something may need to be addressed before continuing.`,
      });
    }
  }

  // --- stalled_milestone: non-complete milestone with no linked task activity in progress_logs for 14+ days ---
  // Get progress_log entries for tasks linked to open milestones
  const milestoneTaskMap = new Map<number, number[]>(); // milestoneId -> taskIds
  for (const t of milestoneTasks) {
    if (t.milestoneId && openMilestoneIds.has(t.milestoneId)) {
      if (!milestoneTaskMap.has(t.milestoneId)) milestoneTaskMap.set(t.milestoneId, []);
      milestoneTaskMap.get(t.milestoneId)!.push(t.id);
    }
  }
  // Get all progress_logs for those milestone task IDs
  const milestoneTaskIds = new Set(milestoneTasks.filter(t => t.milestoneId && openMilestoneIds.has(t.milestoneId)).map(t => t.id));
  const milestoneLogs = recentAllLogs.filter(l => l.taskId !== null && milestoneTaskIds.has(l.taskId!));
  // Build most-recent-log date per milestoneId
  const lastActivityByMilestone = new Map<number, string>();
  for (const log of milestoneLogs) {
    if (!log.taskId) continue;
    const task = milestoneTasks.find(t => t.id === log.taskId);
    if (!task?.milestoneId) continue;
    const logDate = log.date;
    const current = lastActivityByMilestone.get(task.milestoneId);
    if (!current || logDate > current) lastActivityByMilestone.set(task.milestoneId, logDate);
  }

  for (const milestone of allMilestones) {
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

  // --- low_completion_ratio: pillar with 3+ tasks this month and pass/push-to-done ratio > 3:1 ---
  for (const pillar of pillars) {
    const pillarMonthTasks = allTasksThisMonth.filter(t => t.pillarId === pillar.id);
    if (pillarMonthTasks.length < 3) continue;
    const doneCount = pillarMonthTasks.filter(t => t.status === "done").length;
    const deferCount = pillarMonthTasks.filter(t => t.status === "passed" || t.status === "pushed").length;
    // Ratio check: defers > 3× done (guard against doneCount=0)
    const isHighDefer = doneCount === 0 ? deferCount >= 3 : deferCount > 3 * doneCount;
    if (isHighDefer) {
      const ratio = doneCount > 0 ? (deferCount / doneCount).toFixed(1) : `${deferCount}:0`;
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
