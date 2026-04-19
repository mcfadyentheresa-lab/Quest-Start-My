import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, desc, asc } from "drizzle-orm";
import { db, tasksTable, pillarsTable, weeklyPlansTable, progressLogsTable, milestonesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetWeekSummaryResponse,
  GetReentryTaskResponse,
  GetPillarHealthResponse,
  GetOutcomeMetricsResponse,
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

function computePlanningStreak(allPlans: { weekOf: string }[], currentWeekOf: string): number {
  const planWeeks = new Set(allPlans.map(p => p.weekOf));
  let streak = 0;
  let weekCursor = currentWeekOf;
  while (planWeeks.has(weekCursor)) {
    streak++;
    const d = new Date(weekCursor + "T00:00:00");
    d.setDate(d.getDate() - 7);
    weekCursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

function computeGuidance(status: string, suggestedNextStep: string | null | undefined): string | null {
  if (status === "blocked") return "Consider clarifying the blocker or trying a smaller version.";
  if (status === "passed") return "A smaller first step might unlock this.";
  if (status === "pending" && !suggestedNextStep) return "Pick a tiny concrete action to restart momentum.";
  return null;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const weekOf = getWeekStart();

  const [todayTasks, allPillars, weeklyPlans, allWeeklyPlans] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.date, today)),
    db.select().from(pillarsTable).orderBy(pillarsTable.id),
    db.select().from(weeklyPlansTable).where(eq(weeklyPlansTable.weekOf, weekOf)),
    db.select({ weekOf: weeklyPlansTable.weekOf }).from(weeklyPlansTable).orderBy(asc(weeklyPlansTable.weekOf)),
  ]);

  const doneCount = todayTasks.filter(t => t.status === "done").length;
  const pushedCount = todayTasks.filter(t => t.status === "pushed").length;
  const passedCount = todayTasks.filter(t => t.status === "passed").length;
  const blockedCount = todayTasks.filter(t => t.status === "blocked").length;
  const pendingCount = todayTasks.filter(t => t.status === "pending").length;

  const activePillars = allPillars.filter(p => p.isActiveThisWeek);
  const weeklyPlan = weeklyPlans[0] ?? null;
  const planningStreak = computePlanningStreak(allWeeklyPlans, weekOf);

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
    planningStreak,
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

  const pillarMap = new Map(pillars.map(p => [p.id, p.name]));
  const pillarTasksMap = new Map<number, { id: number; title: string; status: string; category: string }[]>();
  for (const task of tasks) {
    if (task.pillarId !== null && task.pillarId !== undefined) {
      if (!pillarTasksMap.has(task.pillarId)) {
        pillarTasksMap.set(task.pillarId, []);
      }
      pillarTasksMap.get(task.pillarId)!.push({
        id: task.id,
        title: task.title,
        status: task.status,
        category: task.category,
      });
    }
  }
  const pillarActivity = Array.from(pillarTasksMap.entries())
    .map(([pillarId, pillarTasks]) => ({
      pillarId,
      pillarName: pillarMap.get(pillarId) ?? "Unknown",
      taskCount: pillarTasks.length,
      tasks: pillarTasks,
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

  // First: look for most recent unfinished (pending) or blocked task from a prior date
  const unfinished = await db.select().from(tasksTable)
    .where(and(
      lt(tasksTable.date, today),
      eq(tasksTable.status, "pending")
    ))
    .orderBy(desc(tasksTable.date), desc(tasksTable.id))
    .limit(1);

  const buildTaskPayload = async (t: typeof unfinished[0]) => {
    let milestoneTitle: string | null = null;
    if (t.milestoneId) {
      const [milestone] = await db.select({ title: milestonesTable.title })
        .from(milestonesTable)
        .where(eq(milestonesTable.id, t.milestoneId));
      milestoneTitle = milestone?.title ?? null;
    }
    return {
      id: t.id,
      title: t.title,
      suggestedNextStep: t.suggestedNextStep,
      whyItMatters: t.whyItMatters,
      blockerReason: t.blockerReason,
      milestoneTitle,
      status: t.status,
      date: t.date,
      category: t.category,
      pillarId: t.pillarId,
    };
  };

  if (unfinished.length > 0 && unfinished[0]) {
    const t = unfinished[0];
    const task = await buildTaskPayload(t);
    const guidance = computeGuidance(t.status, t.suggestedNextStep);
    res.json(GetReentryTaskResponse.parse({
      type: "unfinished",
      task,
      guidance,
    }));
    return;
  }

  // Also check blocked tasks from prior dates
  const blocked = await db.select().from(tasksTable)
    .where(and(
      lt(tasksTable.date, today),
      eq(tasksTable.status, "blocked")
    ))
    .orderBy(desc(tasksTable.date), desc(tasksTable.id))
    .limit(1);

  if (blocked.length > 0 && blocked[0]) {
    const t = blocked[0];
    const task = await buildTaskPayload(t);
    const guidance = computeGuidance(t.status, t.suggestedNextStep);
    res.json(GetReentryTaskResponse.parse({
      type: "unfinished",
      task,
      guidance,
    }));
    return;
  }

  // Check passed tasks from prior dates
  const passed = await db.select().from(tasksTable)
    .where(and(
      lt(tasksTable.date, today),
      eq(tasksTable.status, "passed")
    ))
    .orderBy(desc(tasksTable.date), desc(tasksTable.id))
    .limit(1);

  if (passed.length > 0 && passed[0]) {
    const t = passed[0];
    const task = await buildTaskPayload(t);
    const guidance = computeGuidance(t.status, t.suggestedNextStep);
    res.json(GetReentryTaskResponse.parse({
      type: "unfinished",
      task,
      guidance,
    }));
    return;
  }

  // Fallback: most recent done task from any date
  const completed = await db.select().from(tasksTable)
    .where(eq(tasksTable.status, "done"))
    .orderBy(desc(tasksTable.date), desc(tasksTable.id))
    .limit(1);

  if (completed.length > 0 && completed[0]) {
    const t = completed[0];
    const task = await buildTaskPayload(t);
    res.json(GetReentryTaskResponse.parse({
      type: "completed",
      task,
      guidance: null,
    }));
    return;
  }

  res.json(GetReentryTaskResponse.parse({ type: "none", task: null, guidance: null }));
});

router.get("/dashboard/pillar-health", async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const weekEnd = getWeekEnd(weekOf);

  const [pillars, weekTasks, recentLogs] = await Promise.all([
    db.select().from(pillarsTable).orderBy(pillarsTable.id),
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(progressLogsTable).orderBy(desc(progressLogsTable.loggedAt)),
  ]);

  const totalDoneThisWeek = weekTasks.filter(t => t.status === "done").length;

  const allTasks = await db.select({ id: tasksTable.id, pillarId: tasksTable.pillarId }).from(tasksTable);
  const taskPillarMap = new Map(allTasks.map(t => [t.id, t.pillarId]));

  const pillarEntries = pillars.map(pillar => {
    const pillarWeekTasks = weekTasks.filter(t => t.pillarId === pillar.id);
    const tasksDoneThisWeek = pillarWeekTasks.filter(t => t.status === "done").length;
    const tasksPushedOrPassedThisWeek = pillarWeekTasks.filter(t => t.status === "pushed" || t.status === "passed").length;

    const pillarLogs = recentLogs.filter(log => {
      const taskPillarId = log.taskId ? taskPillarMap.get(log.taskId) : null;
      return taskPillarId === pillar.id;
    });

    let daysSinceLastMovement: number | null = null;
    if (pillarLogs.length > 0 && pillarLogs[0]) {
      const lastDate = new Date(pillarLogs[0].loggedAt);
      const now = new Date();
      daysSinceLastMovement = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    let nudge: string | null = null;
    if (daysSinceLastMovement !== null && daysSinceLastMovement >= 7) {
      nudge = "No movement in 7 days — one tiny action?";
    } else if (daysSinceLastMovement === null && pillarWeekTasks.length === 0) {
      nudge = "No tasks this week — is this pillar still active?";
    }

    let warning: string | null = null;
    if (
      (pillar.portfolioStatus === "Warm" || pillar.portfolioStatus === "Parked") &&
      totalDoneThisWeek > 0 &&
      tasksDoneThisWeek / totalDoneThisWeek > 0.3
    ) {
      warning = `${pillar.portfolioStatus} project absorbing ${Math.round(tasksDoneThisWeek / totalDoneThisWeek * 100)}% of completed work this week.`;
    }

    const portfolioSharePercent = totalDoneThisWeek > 0
      ? Math.round((tasksDoneThisWeek / totalDoneThisWeek) * 100)
      : null;

    return {
      pillarId: pillar.id,
      pillarName: pillar.name,
      portfolioStatus: pillar.portfolioStatus ?? null,
      tasksDoneThisWeek,
      tasksPushedOrPassedThisWeek,
      daysSinceLastMovement,
      nudge,
      warning,
      portfolioSharePercent,
    };
  });

  // Compute portfolio balance by portfolioStatus bucket
  const statusBuckets = { active: 0, warm: 0, parked: 0, other: 0 };
  if (totalDoneThisWeek > 0) {
    for (const entry of pillarEntries) {
      const done = entry.tasksDoneThisWeek;
      const status = (entry.portfolioStatus ?? "").toLowerCase();
      if (status === "active") statusBuckets.active += done;
      else if (status === "warm") statusBuckets.warm += done;
      else if (status === "parked") statusBuckets.parked += done;
      else statusBuckets.other += done;
    }
  }
  const toPercent = (n: number) => totalDoneThisWeek > 0 ? Math.round((n / totalDoneThisWeek) * 100) : 0;
  const portfolioBalance = {
    activeShare: toPercent(statusBuckets.active),
    warmShare: toPercent(statusBuckets.warm),
    parkedShare: toPercent(statusBuckets.parked),
    otherShare: toPercent(statusBuckets.other),
  };

  res.json(GetPillarHealthResponse.parse({ pillars: pillarEntries, portfolioBalance }));
});

router.get("/dashboard/outcome-metrics", async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const weekEnd = getWeekEnd(weekOf);
  const monthStart = weekOf.slice(0, 7) + "-01";
  const today = new Date().toISOString().slice(0, 10);

  const [weekTasks, pillars, allMilestones] = await Promise.all([
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(pillarsTable).orderBy(pillarsTable.id),
    db.select().from(milestonesTable),
  ]);

  // Milestones completed this week (status = complete and targetDate within week)
  const milestonesCompletedThisWeek = allMilestones.filter(m =>
    m.status === "complete" && m.targetDate && m.targetDate >= weekOf && m.targetDate <= weekEnd
  ).length;

  // Milestones completed this month
  const milestonesCompletedThisMonth = allMilestones.filter(m =>
    m.status === "complete" && m.targetDate && m.targetDate >= monthStart && m.targetDate <= today
  ).length;

  // Average active milestone days — rough estimate: compare createdAt with now for active milestones
  const activeMilestones = allMilestones.filter(m => m.status === "active");
  let averageActiveMilestoneDays: number | null = null;
  if (activeMilestones.length > 0) {
    const now = Date.now();
    const totalDays = activeMilestones.reduce((sum, m) => {
      const days = Math.floor((now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    averageActiveMilestoneDays = Math.round(totalDays / activeMilestones.length);
  }

  // Per-pillar task metrics for this week
  const pillarMetrics = pillars.map(pillar => {
    const pillarTasks = weekTasks.filter(t => t.pillarId === pillar.id);
    const doneCount = pillarTasks.filter(t => t.status === "done").length;
    const blockedCount = pillarTasks.filter(t => t.status === "blocked").length;
    const passedCount = pillarTasks.filter(t => t.status === "passed").length;
    const totalCount = pillarTasks.filter(t => t.status !== "pending").length; // exclude still-pending
    const completionRate = totalCount > 0 ? doneCount / totalCount : 0;
    return { pillarId: pillar.id, pillarName: pillar.name, completionRate, doneCount, totalCount, blockedCount, passedCount };
  });

  // P1 completed this week: tasks linked to P1-priority pillars
  const p1PillarIds = new Set(pillars.filter(p => p.priority === "P1").map(p => p.id));
  const p1CompletedThisWeek = weekTasks.filter(t => t.status === "done" && t.pillarId !== null && p1PillarIds.has(t.pillarId!)).length;

  // Warm/Parked completed this week
  const warmParkedPillarIds = new Set(pillars.filter(p => p.portfolioStatus === "Warm" || p.portfolioStatus === "Parked").map(p => p.id));
  const warmParkedCompletedThisWeek = weekTasks.filter(t => t.status === "done" && t.pillarId !== null && warmParkedPillarIds.has(t.pillarId!)).length;

  res.json(GetOutcomeMetricsResponse.parse({
    milestonesCompletedThisWeek,
    milestonesCompletedThisMonth,
    averageActiveMilestoneDays,
    pillarMetrics,
    p1CompletedThisWeek,
    warmParkedCompletedThisWeek,
  }));
});

export default router;
