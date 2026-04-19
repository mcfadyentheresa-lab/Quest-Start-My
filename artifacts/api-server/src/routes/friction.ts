import { Router, type IRouter } from "express";
import { and, gte, eq } from "drizzle-orm";
import { db, tasksTable, pillarsTable, milestonesTable, progressLogsTable } from "@workspace/db";
import { GetFrictionSignalsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

router.get("/dashboard/friction", async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const fourteenDaysAgo = daysAgo(14);
  const weekEnd = new Date(weekOf);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const [pillars, recentTasks, allMilestones] = await Promise.all([
    db.select().from(pillarsTable),
    db.select().from(tasksTable).where(gte(tasksTable.date, fourteenDaysAgo)),
    db.select().from(milestonesTable),
  ]);

  const pillarMap = new Map(pillars.map(p => [p.id, p]));
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

  // --- repeated_pass: pillar with 3+ passed tasks in last 14 days ---
  const passedByPillar = new Map<number, { tasks: { id: number; title: string }[] }>();
  for (const task of recentTasks) {
    if (task.status === "passed" && task.pillarId !== null) {
      if (!passedByPillar.has(task.pillarId)) passedByPillar.set(task.pillarId, { tasks: [] });
      passedByPillar.get(task.pillarId)!.tasks.push({ id: task.id, title: task.title });
    }
  }
  for (const [pillarId, { tasks }] of passedByPillar.entries()) {
    if (tasks.length >= 3) {
      const pillar = pillarMap.get(pillarId);
      signals.push({
        type: "repeated_pass",
        pillarId,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `${tasks.length} tasks passed (deferred) in this pillar over the last 14 days — consider tackling one directly.`,
      });
    }
  }

  // --- repeated_block: task that appears blocked across multiple log entries ---
  const blockedLogs = await db
    .select()
    .from(progressLogsTable)
    .where(and(eq(progressLogsTable.status, "blocked"), gte(progressLogsTable.date, fourteenDaysAgo)));

  // Group by taskTitle (tasks may not persist across days, so use title as proxy)
  const blockedByTitle = new Map<string, { count: number; taskId: number | null; pillarId: number | null }>();
  for (const log of blockedLogs) {
    const existing = blockedByTitle.get(log.taskTitle);
    if (!existing) {
      const taskPillarId = log.taskId
        ? (recentTasks.find(t => t.id === log.taskId)?.pillarId ?? null)
        : null;
      blockedByTitle.set(log.taskTitle, { count: 1, taskId: log.taskId, pillarId: taskPillarId });
    } else {
      existing.count++;
    }
  }
  for (const [taskTitle, { count, taskId, pillarId }] of blockedByTitle.entries()) {
    if (count >= 2) {
      const pillar = pillarId ? pillarMap.get(pillarId) : null;
      signals.push({
        type: "repeated_block",
        pillarId: pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId: taskId ?? null,
        taskTitle,
        milestoneId: null,
        milestoneTitle: null,
        detail: `"${taskTitle}" has been blocked ${count} times recently — worth addressing the blocker or breaking it down.`,
      });
    }
  }

  // --- stalled_milestone: active milestone with createdAt 30+ days ago ---
  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const milestone of allMilestones) {
    if (milestone.status === "active" && new Date(milestone.createdAt).getTime() < thirtyDaysAgoMs) {
      const pillar = milestone.pillarId ? pillarMap.get(milestone.pillarId) : null;
      const daysActive = Math.floor((Date.now() - new Date(milestone.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      signals.push({
        type: "stalled_milestone",
        pillarId: milestone.pillarId ?? null,
        pillarName: pillar?.name ?? null,
        taskId: null,
        taskTitle: null,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        detail: `Milestone "${milestone.title}" has been active for ${daysActive} days without completing — review scope or next action.`,
      });
    }
  }

  // --- low_completion_ratio: pillar with <25% completion rate this week (min 4 attempted tasks) ---
  for (const pillar of pillars) {
    const pillarWeekTasks = recentTasks.filter(t =>
      t.pillarId === pillar.id && t.date >= weekOf && t.date <= weekEndStr
    );
    const attempted = pillarWeekTasks.filter(t => t.status !== "pending");
    const done = attempted.filter(t => t.status === "done").length;
    if (attempted.length >= 4 && done / attempted.length < 0.25) {
      signals.push({
        type: "low_completion_ratio",
        pillarId: pillar.id,
        pillarName: pillar.name,
        taskId: null,
        taskTitle: null,
        milestoneId: null,
        milestoneTitle: null,
        detail: `Only ${done} of ${attempted.length} attempted tasks completed this week (${Math.round(done / attempted.length * 100)}%) — review what's blocking progress.`,
      });
    }
  }

  res.json(GetFrictionSignalsResponse.parse(signals));
});

export default router;
