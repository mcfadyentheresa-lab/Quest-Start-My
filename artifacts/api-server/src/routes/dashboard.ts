import { Router, type IRouter } from "express";
import { eq, and, gte, lte, lt, desc, asc } from "drizzle-orm";
import { db, tasksTable, areasTable, weeklyPlansTable, progressLogsTable, milestonesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetWeekSummaryResponse,
  GetReentryTaskResponse,
  GetAreaHealthResponse,
  GetOutcomeMetricsResponse,
  GetAreaCompletionHistoryResponse,
  GetAreaCompletionHistoryQueryParams as GetAreaCompletionHistoryParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";

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

router.get("/dashboard/summary", asyncHandler(async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const weekOf = getWeekStart();

  const [todayTasks, allAreas, weeklyPlans, allWeeklyPlans] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.date, today)),
    db.select().from(areasTable).orderBy(areasTable.id),
    db.select().from(weeklyPlansTable).where(eq(weeklyPlansTable.weekOf, weekOf)),
    db.select({ weekOf: weeklyPlansTable.weekOf }).from(weeklyPlansTable).orderBy(asc(weeklyPlansTable.weekOf)),
  ]);

  const doneCount = todayTasks.filter(t => t.status === "done").length;
  const pushedCount = todayTasks.filter(t => t.status === "pushed").length;
  const passedCount = todayTasks.filter(t => t.status === "passed").length;
  const blockedCount = todayTasks.filter(t => t.status === "blocked").length;
  const pendingCount = todayTasks.filter(t => t.status === "pending").length;

  const activeAreas = allAreas.filter(p => p.isActiveThisWeek);
  const weeklyPlan = weeklyPlans[0] ?? null;
  const planningStreak = computePlanningStreak(allWeeklyPlans, weekOf);

  const serializeArea = (p: typeof allAreas[0]) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  });

  const serializePlan = (p: typeof weeklyPlan) => p ? {
    ...p,
    areaPriorities: (p.areaPriorities ?? []).map(Number),
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
    activeAreas: activeAreas.map(serializeArea),
    weeklyPlan: serializePlan(weeklyPlan),
    planningStreak,
  }));
}));

router.get("/dashboard/week-summary", asyncHandler(async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const weekEnd = getWeekEnd(weekOf);

  const [tasks, areas] = await Promise.all([
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(areasTable),
  ]);

  const totalTasks = tasks.length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const pushedCount = tasks.filter(t => t.status === "pushed").length;
  const passedCount = tasks.filter(t => t.status === "passed").length;
  const blockedCount = tasks.filter(t => t.status === "blocked").length;
  const completionRate = totalTasks > 0 ? doneCount / totalTasks : 0;

  const areaMap = new Map(areas.map(p => [p.id, p.name]));
  const areaTasksMap = new Map<number, { id: number; title: string; status: string; category: string }[]>();
  for (const task of tasks) {
    if (task.areaId !== null && task.areaId !== undefined) {
      if (!areaTasksMap.has(task.areaId)) {
        areaTasksMap.set(task.areaId, []);
      }
      areaTasksMap.get(task.areaId)!.push({
        id: task.id,
        title: task.title,
        status: task.status,
        category: task.category,
      });
    }
  }
  const areaActivity = Array.from(areaTasksMap.entries())
    .map(([areaId, areaTasks]) => ({
      areaId,
      areaName: areaMap.get(areaId) ?? "Unknown",
      taskCount: areaTasks.length,
      tasks: areaTasks,
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
    areaActivity,
  }));
}));

router.get("/dashboard/reentry", asyncHandler(async (req, res): Promise<void> => {
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
      areaId: t.areaId,
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
}));

router.get("/dashboard/area-health", asyncHandler(async (req, res): Promise<void> => {
  const weekOf = getWeekStart();
  const weekEnd = getWeekEnd(weekOf);

  const [areas, weekTasks, recentLogs] = await Promise.all([
    db.select().from(areasTable).orderBy(areasTable.id),
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(progressLogsTable).orderBy(desc(progressLogsTable.loggedAt)),
  ]);

  const totalDoneThisWeek = weekTasks.filter(t => t.status === "done").length;

  const allTasks = await db.select({ id: tasksTable.id, areaId: tasksTable.areaId }).from(tasksTable);
  const taskAreaMap = new Map(allTasks.map(t => [t.id, t.areaId]));

  const areaEntries = areas.map(area => {
    const areaWeekTasks = weekTasks.filter(t => t.areaId === area.id);
    const tasksDoneThisWeek = areaWeekTasks.filter(t => t.status === "done").length;
    const tasksPushedOrPassedThisWeek = areaWeekTasks.filter(t => t.status === "pushed" || t.status === "passed").length;

    const areaLogs = recentLogs.filter(log => {
      const taskAreaId = log.taskId ? taskAreaMap.get(log.taskId) : null;
      return taskAreaId === area.id;
    });

    let daysSinceLastMovement: number | null = null;
    if (areaLogs.length > 0 && areaLogs[0]) {
      const lastDate = new Date(areaLogs[0].loggedAt);
      const now = new Date();
      daysSinceLastMovement = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    let nudge: string | null = null;
    if (daysSinceLastMovement !== null && daysSinceLastMovement >= 7) {
      nudge = "No movement in 7 days — one tiny action?";
    } else if (daysSinceLastMovement === null && areaWeekTasks.length === 0) {
      nudge = "No tasks this week — is this area still active?";
    }

    let warning: string | null = null;
    if (
      (area.portfolioStatus === "Warm" || area.portfolioStatus === "Parked") &&
      totalDoneThisWeek > 0 &&
      tasksDoneThisWeek / totalDoneThisWeek > 0.3
    ) {
      warning = `${area.portfolioStatus} project absorbing ${Math.round(tasksDoneThisWeek / totalDoneThisWeek * 100)}% of completed work this week.`;
    }

    const portfolioSharePercent = totalDoneThisWeek > 0
      ? Math.round((tasksDoneThisWeek / totalDoneThisWeek) * 100)
      : null;

    return {
      areaId: area.id,
      areaName: area.name,
      portfolioStatus: area.portfolioStatus ?? null,
      tasksDoneThisWeek,
      tasksPushedOrPassedThisWeek,
      daysSinceLastMovement,
      nudge,
      warning,
      portfolioSharePercent,
    };
  });

  // Compute portfolio balance: Active / Warm / Parked shares of done tasks
  const statusBuckets = { active: 0, warm: 0, parked: 0 };
  if (totalDoneThisWeek > 0) {
    for (const entry of areaEntries) {
      const done = entry.tasksDoneThisWeek;
      const status = (entry.portfolioStatus ?? "").toLowerCase();
      if (status === "active") statusBuckets.active += done;
      else if (status === "warm") statusBuckets.warm += done;
      else if (status === "parked") statusBuckets.parked += done;
    }
  }
  const toPercent = (n: number) => totalDoneThisWeek > 0 ? Math.round((n / totalDoneThisWeek) * 100) : 0;
  const portfolioBalance = {
    activeShare: toPercent(statusBuckets.active),
    warmShare: toPercent(statusBuckets.warm),
    parkedShare: toPercent(statusBuckets.parked),
  };

  res.json(GetAreaHealthResponse.parse({ areas: areaEntries, portfolioBalance }));
}));

router.get("/dashboard/outcome-metrics", asyncHandler(async (req, res): Promise<void> => {
  const weekOfParam = typeof req.query.weekOf === "string" ? req.query.weekOf : null;
  if (weekOfParam !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOfParam) || isNaN(Date.parse(weekOfParam + "T00:00:00"))) {
      res.status(400).json({ error: "weekOf must be a valid date in YYYY-MM-DD format" });
      return;
    }
  }
  const weekOf = weekOfParam ?? getWeekStart();
  const weekEnd = getWeekEnd(weekOf);
  // Derive month start from the selected week's start date
  const monthStart = weekOf.slice(0, 7) + "-01";

  const [weekTasks, areas, allMilestones] = await Promise.all([
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, weekOf),
      lte(tasksTable.date, weekEnd)
    )),
    db.select().from(areasTable).orderBy(areasTable.id),
    db.select().from(milestonesTable),
  ]);

  // Milestones completed this week: status=complete AND createdAt within this week
  const milestonesCompletedThisWeek = allMilestones.filter(m => {
    if (m.status !== "complete") return false;
    const created = m.createdAt.toISOString().slice(0, 10);
    return created >= weekOf && created <= weekEnd;
  }).length;

  // Milestones completed this month: status=complete AND createdAt from start of month through end of selected week
  const milestonesCompletedThisMonth = allMilestones.filter(m => {
    if (m.status !== "complete") return false;
    const created = m.createdAt.toISOString().slice(0, 10);
    return created >= monthStart && created <= weekEnd;
  }).length;

  // Average age in days of milestones with status active OR planned
  const openMilestones = allMilestones.filter(m => m.status === "active" || m.status === "planned");
  let averageActiveMilestoneDays: number | null = null;
  if (openMilestones.length > 0) {
    const now = Date.now();
    const totalDays = openMilestones.reduce((sum, m) => {
      const days = Math.floor((now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    averageActiveMilestoneDays = Math.round(totalDays / openMilestones.length);
  }

  // Per-area task metrics for this week (exclude still-pending from denominator)
  const areaMetrics = areas.map(area => {
    const areaTasks = weekTasks.filter(t => t.areaId === area.id);
    const doneCount = areaTasks.filter(t => t.status === "done").length;
    const blockedCount = areaTasks.filter(t => t.status === "blocked").length;
    const passedCount = areaTasks.filter(t => t.status === "passed").length;
    const totalCount = areaTasks.filter(t => t.status !== "pending").length;
    const completionRate = totalCount > 0 ? doneCount / totalCount : 0;
    return { areaId: area.id, areaName: area.name, completionRate, doneCount, totalCount, blockedCount, passedCount };
  });

  // P1 vs Warm/Parked effort ratio this week
  const p1AreaIds = new Set(areas.filter(p => p.priority === "P1").map(p => p.id));
  const warmParkedAreaIds = new Set(areas.filter(p => p.portfolioStatus === "Warm" || p.portfolioStatus === "Parked").map(p => p.id));
  const p1CompletedThisWeek = weekTasks.filter(t => t.status === "done" && t.areaId !== null && p1AreaIds.has(t.areaId!)).length;
  const warmParkedCompletedThisWeek = weekTasks.filter(t => t.status === "done" && t.areaId !== null && warmParkedAreaIds.has(t.areaId!)).length;
  const p1VsWarmParkedRatio = warmParkedCompletedThisWeek > 0
    ? Math.round((p1CompletedThisWeek / warmParkedCompletedThisWeek) * 100) / 100
    : null;

  res.json(GetOutcomeMetricsResponse.parse({
    milestonesCompletedThisWeek,
    milestonesCompletedThisMonth,
    averageActiveMilestoneDays,
    areaMetrics,
    p1CompletedThisWeek,
    warmParkedCompletedThisWeek,
    p1VsWarmParkedRatio,
  }));
}));

function getPastWeekStarts(n: number, fromWeekStart: string): string[] {
  const weeks: string[] = [];
  let cursor = fromWeekStart;
  for (let i = 0; i < n; i++) {
    weeks.unshift(cursor);
    const d = new Date(cursor + "T00:00:00");
    d.setDate(d.getDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }
  return weeks;
}

router.get("/dashboard/area-completion-history", asyncHandler(async (req, res): Promise<void> => {
  const parsed = GetAreaCompletionHistoryParams.safeParse(req.query);
  const weekCount = parsed.success && parsed.data.weeks !== undefined
    ? Math.min(Math.max(parsed.data.weeks, 1), 52)
    : 4;

  const currentWeekOf = getWeekStart();
  const weeks = getPastWeekStarts(weekCount, currentWeekOf);

  const oldestWeekStart = weeks[0];
  const newestWeekEnd = getWeekEnd(weeks[weeks.length - 1]);

  const [allTasks, areas] = await Promise.all([
    db.select().from(tasksTable).where(and(
      gte(tasksTable.date, oldestWeekStart),
      lte(tasksTable.date, newestWeekEnd),
    )),
    db.select().from(areasTable).orderBy(areasTable.id),
  ]);

  const areaData = areas.map(area => {
    const weeklyRates = weeks.map(weekStart => {
      const weekEnd = getWeekEnd(weekStart);
      const areaTasks = allTasks.filter(t =>
        t.areaId === area.id &&
        t.date >= weekStart &&
        t.date <= weekEnd &&
        t.status !== "pending"
      );
      if (areaTasks.length === 0) return 0;
      const doneCount = areaTasks.filter(t => t.status === "done").length;
      return doneCount / areaTasks.length;
    });
    return { areaId: area.id, areaName: area.name, weeklyRates };
  });

  res.json(GetAreaCompletionHistoryResponse.parse({ weeks, areas: areaData }));
}));

export default router;
