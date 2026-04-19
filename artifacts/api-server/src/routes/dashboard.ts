import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, tasksTable, pillarsTable, weeklyPlansTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetWeekSummaryResponse,
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

  const tasks = await db.select().from(tasksTable)
    .where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    ));

  const totalTasks = tasks.length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const pushedCount = tasks.filter(t => t.status === "pushed").length;
  const passedCount = tasks.filter(t => t.status === "passed").length;
  const blockedCount = tasks.filter(t => t.status === "blocked").length;
  const completionRate = totalTasks > 0 ? doneCount / totalTasks : 0;

  res.json(GetWeekSummaryResponse.parse({
    weekOf,
    totalTasks,
    doneCount,
    pushedCount,
    passedCount,
    blockedCount,
    completionRate,
  }));
});

export default router;
