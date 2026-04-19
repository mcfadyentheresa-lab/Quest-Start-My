import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, ne } from "drizzle-orm";
import { db, tasksTable, pillarsTable, weeklyPlansTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetWeekSummaryResponse,
  GetReentryTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const weekOf = getWeekStart();

  const [todayTasks, allPillars, weeklyPlans] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.date, today)),
    db.select().from(pillarsTable).orderBy(pillarsTable.id),
    db.select().from(weeklyPlansTable).where(eq(weeklyPlansTable.weekOf, weekOf)),
  ]);

  const doneCount = todayTasks.filter(t => t.status === "done").length;
  const pushedCount = todayTasks.filter(t => t.status === "pushed").length;
  const passedCount = todayTasks.filter(t => t.status === "passed").length;
  const blockedCount = todayTasks.filter(t => t.status === "blocked").length;
  const pendingCount = todayTasks.filter(t => t.status === "pending").length;

  const activePillars = allPillars.filter(p => p.isActiveThisWeek);
  const weeklyPlan = weeklyPlans[0] ?? null;

  const serializePillar = (p: typeof allPillars[0]) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  });

  const serializePlan = (p: typeof weeklyPlan) => p ? {
    ...p,
    activePillarIds: (p.activePillarIds ?? []).map(Number),
    createdAt: p.createdAt.toISOString(),
  } : null;

  res.json(GetDashboardSummaryResponse.parse({
    todayDate: today,
    totalTasksToday: todayTasks.length,
    doneCount,
    pushedCount,
    passedCount,
    blockedCount,
    pendingCount,
    activePillars: activePillars.map(serializePillar),
    weeklyPlan: serializePlan(weeklyPlan),
  }));
});

router.get("/dashboard/week-summary", async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const weekEnd = getWeekEnd(weekOf);

  const [tasks, pillars] = await Promise.all([
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(pillarsTable),
  ]);

  const totalTasks = tasks.length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const pushedCount = tasks.filter(t => t.status === "pushed").length;
  const passedCount = tasks.filter(t => t.status === "passed").length;
  const blockedCount = tasks.filter(t => t.status === "blocked").length;
  const completionRate = totalTasks > 0 ? doneCount / totalTasks : 0;

  // Build pillar activity
  const pillarMap = new Map(pillars.map(p => [p.id, p.name]));
  const pillarCounts = new Map<number, number>();
  for (const task of tasks) {
    if (task.pillarId !== null && task.pillarId !== undefined) {
      pillarCounts.set(task.pillarId, (pillarCounts.get(task.pillarId) ?? 0) + 1);
    }
  }
  const pillarActivity = Array.from(pillarCounts.entries())
    .map(([pillarId, taskCount]) => ({
      pillarId,
      pillarName: pillarMap.get(pillarId) ?? "Unknown",
      taskCount,
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  res.json(GetWeekSummaryResponse.parse({
    weekOf,
    totalTasks,
    doneCount,
    pushedCount,
    passedCount,
    blockedCount,
    completionRate,
    pillarActivity,
  }));
});

router.get("/dashboard/reentry", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  // First: look for most recent unfinished (pending) task from a prior date
  const unfinished = await db.select().from(tasksTable)
    .where(and(
      lt(tasksTable.date, today),
      eq(tasksTable.status, "pending")
    ))
    .orderBy(tasksTable.date)
    .limit(1);

  if (unfinished.length > 0 && unfinished[0]) {
    const t = unfinished[0];
    res.json(GetReentryTaskResponse.parse({
      type: "unfinished",
      task: {
        id: t.id,
        title: t.title,
        suggestedNextStep: t.suggestedNextStep,
        status: t.status,
        date: t.date,
        category: t.category,
        pillarId: t.pillarId,
      },
    }));
    return;
  }

  // Fallback: most recent completed task from any date
  const completed = await db.select().from(tasksTable)
    .where(ne(tasksTable.status, "pending"))
    .orderBy(tasksTable.date)
    .limit(1);

  if (completed.length > 0 && completed[0]) {
    const t = completed[0];
    res.json(GetReentryTaskResponse.parse({
      type: "completed",
      task: {
        id: t.id,
        title: t.title,
        suggestedNextStep: t.suggestedNextStep,
        status: t.status,
        date: t.date,
        category: t.category,
        pillarId: t.pillarId,
      },
    }));
    return;
  }

  res.json(GetReentryTaskResponse.parse({ type: "none", task: null }));
});

export default router;
