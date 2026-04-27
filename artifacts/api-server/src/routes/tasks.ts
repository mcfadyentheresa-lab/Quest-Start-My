import { Router, type IRouter } from "express";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db, tasksTable, progressLogsTable, pillarsTable, milestonesTable, weeklyPlansTable } from "@workspace/db";
import type { PillarPriorityMap } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  ListTasksQueryParams,
  ListTasksResponse,
  UpdateTaskResponse,
  StepBackTaskParams,
  GetTaskSuggestionsQueryParams,
} from "@workspace/api-zod";
import { scoped, userIdFrom } from "../lib/scoped";
import { getUserToday, getWeekKey } from "../lib/time";
import { assertCanCreateTask } from "../lib/plan";

const router: IRouter = Router();

const MAX_STEP_BACK_DEPTH = 3;

function tzOf(req: { userTimezone?: string }): string {
  return req.userTimezone ?? "America/Toronto";
}

interface GeneratedTask {
  title: string;
  whyItMatters: string;
  doneLooksLike: string;
  suggestedNextStep: string;
  adjustmentReason: string;
}

const VERB_PATTERNS: [RegExp, string, string][] = [
  [/^(review|revise|evaluate)\b/i, "Create", "Missing foundation"],
  [/^(update|improve|enhance|polish)\b/i, "Draft", "Missing draft"],
  [/^(refine|iterate on|perfect)\b/i, "Outline", "Missing outline"],
  [/^(publish|release|ship)\b/i, "Prepare", "Missing preparation"],
  [/^(launch|roll out)\b/i, "Finalize plan for", "Missing plan"],
  [/^(contact|reach out to|email|message|pitch)\b/i, "Create a shortlist of", "Missing shortlist"],
  [/^(analyze|analyse|measure|audit)\b/i, "Collect data for", "Missing data"],
  [/^(organize|organise|sort|arrange)\b/i, "Gather material for", "Missing material"],
  [/^(finalize|finalise|complete|finish)\b/i, "Outline", "Missing outline"],
  [/^(present|present|demo|show)\b/i, "Prepare", "Missing preparation"],
  [/^(build|create|develop|design)\b/i, "Sketch a simple version of", "Missing foundation"],
  [/^(write|draft|document)\b/i, "Outline", "Missing outline"],
  [/^(set up|setup|configure|install)\b/i, "Plan the setup steps for", "Missing setup plan"],
];

function generateStepBackTask(originalTitle: string, originalDepth: number): GeneratedTask {
  const trimmed = originalTitle.trim();

  for (const [pattern, verb, reason] of VERB_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const rest = trimmed.slice(match[0].length).trim();
      const newTitle = rest ? `${verb} ${rest}` : `${verb} the prerequisite for: ${trimmed}`;
      return {
        title: newTitle,
        whyItMatters: `This foundation needs to exist before "${trimmed}" can move forward. Building it first prevents getting stuck mid-task.`,
        doneLooksLike: `You have a clear, usable starting point for "${trimmed}" — enough to move to the next level.`,
        suggestedNextStep: originalDepth === 0
          ? "Start with the simplest possible version — even a rough draft counts."
          : "Keep it small and concrete. One action, one output.",
        adjustmentReason: reason,
      };
    }
  }

  return {
    title: `Prepare the foundation for: ${trimmed}`,
    whyItMatters: `"${trimmed}" assumes something already exists. This step builds that missing piece first.`,
    doneLooksLike: `You have enough in place to return to "${trimmed}" and make real progress.`,
    suggestedNextStep: "Identify the single most important thing needed before the original task can proceed.",
    adjustmentReason: "Missing foundation",
  };
}

function serializeTask(task: typeof tasksTable.$inferSelect) {
  return { ...task, createdAt: task.createdAt.toISOString() };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const s = scoped(userIdFrom(req));
  const query = ListTasksQueryParams.safeParse(req.query);
  const today = getUserToday(tzOf(req));
  const date = query.success && query.data.date ? query.data.date : today;
  const source = query.success ? query.data.source : undefined;

  const whereClause = source
    ? and(s.tasks.owns, eq(tasksTable.date, date), eq(tasksTable.taskSource, source))
    : and(s.tasks.owns, eq(tasksTable.date, date), isNull(tasksTable.taskSource));

  const tasks = await db.select().from(tasksTable)
    .where(whereClause)
    .orderBy(tasksTable.createdAt);

  res.json(ListTasksResponse.parse(tasks.map(serializeTask)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = userIdFrom(req);
  await assertCanCreateTask(userId);
  const s = scoped(userId);
  const [task] = await db.insert(tasksTable).values(s.tasks.withUser({
    title: parsed.data.title,
    category: parsed.data.category,
    whyItMatters: parsed.data.whyItMatters ?? null,
    doneLooksLike: parsed.data.doneLooksLike ?? null,
    suggestedNextStep: parsed.data.suggestedNextStep ?? null,
    pillarId: parsed.data.pillarId ?? null,
    milestoneId: parsed.data.milestoneId ?? null,
    blockerReason: parsed.data.blockerReason ?? null,
    taskSource: parsed.data.taskSource ?? null,
    date: parsed.data.date,
    status: "pending",
  })).returning();

  res.status(201).json(serializeTask(task));
});

router.get("/tasks/suggestions", async (req, res): Promise<void> => {
  const s = scoped(userIdFrom(req));
  const queryResult = GetTaskSuggestionsQueryParams.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ error: queryResult.error.message });
    return;
  }
  const tz = tzOf(req);
  const today = getUserToday(tz);
  const date = queryResult.data.date ?? today;

  // Active pillars: source of truth is weekly_plans.activePillarIds for the
  // current week. Priority is per-week and lives in weekly_plans.pillarPriorities.
  const weekOf = getWeekKey(today, tz);
  const [weeklyPlan] = await db
    .select()
    .from(weeklyPlansTable)
    .where(and(s.weeklyPlans.owns, eq(weeklyPlansTable.weekOf, weekOf)));

  const activePillarIdsFromPlan = (weeklyPlan?.activePillarIds ?? []).map(Number).filter(Number.isFinite);
  if (activePillarIdsFromPlan.length === 0) {
    res.json([]);
    return;
  }

  const allPillars = await db
    .select()
    .from(pillarsTable)
    .where(and(s.pillars.owns, inArray(pillarsTable.id, activePillarIdsFromPlan)));

  const priorityMap: PillarPriorityMap = (weeklyPlan?.pillarPriorities ?? {}) as PillarPriorityMap;
  const priorityRank: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const activePillars = [...allPillars].sort((a, b) => {
    const ap = priorityRank[priorityMap[String(a.id)] ?? "P4"] ?? 4;
    const bp = priorityRank[priorityMap[String(b.id)] ?? "P4"] ?? 4;
    if (ap !== bp) return ap - bp;
    return a.id - b.id;
  });

  if (activePillars.length === 0) {
    res.json([]);
    return;
  }

  // Tasks already on this date (non-home tasks)
  const existingTasks = await db
    .select({ pillarId: tasksTable.pillarId })
    .from(tasksTable)
    .where(and(s.tasks.owns, eq(tasksTable.date, date), isNull(tasksTable.taskSource)));

  const coveredPillarIds = new Set(
    existingTasks.flatMap(t => (t.pillarId != null ? [t.pillarId] : []))
  );
  const slotsAvailable = Math.max(0, 3 - existingTasks.length);

  if (slotsAvailable === 0) {
    res.json([]);
    return;
  }

  // Planned milestones for all active pillars, ordered by sort_order then id
  const activePillarIdsLocal = activePillars.map(p => p.id);
  const allMilestones = await db
    .select()
    .from(milestonesTable)
    .where(and(s.milestones.owns, eq(milestonesTable.status, "planned")))
    .orderBy(milestonesTable.sortOrder, milestonesTable.id);

  const milestonesByPillar = new Map<number, typeof allMilestones>();
  for (const m of allMilestones) {
    if (!activePillarIdsLocal.includes(m.pillarId)) continue;
    if (!milestonesByPillar.has(m.pillarId)) milestonesByPillar.set(m.pillarId, []);
    milestonesByPillar.get(m.pillarId)!.push(m);
  }

  const suggestions: {
    title: string;
    pillarId: number;
    pillarName: string;
    pillarColor: string | null;
    pillarCategory: string | null;
    milestoneId: number;
    milestoneTitle: string;
  }[] = [];

  for (const pillar of activePillars) {
    if (suggestions.length >= slotsAvailable) break;
    if (coveredPillarIds.has(pillar.id)) continue;

    const candidateMilestones = milestonesByPillar.get(pillar.id) ?? [];
    const milestone = candidateMilestones.find(m => m.nextAction && m.nextAction.trim());
    if (!milestone) continue;

    suggestions.push({
      title: milestone.nextAction!.trim(),
      pillarId: pillar.id,
      pillarName: pillar.name,
      pillarColor: pillar.color ?? null,
      pillarCategory: pillar.category ?? null,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
    });
  }

  res.json(suggestions);
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.whyItMatters !== undefined) updates.whyItMatters = parsed.data.whyItMatters;
  if (parsed.data.doneLooksLike !== undefined) updates.doneLooksLike = parsed.data.doneLooksLike;
  if (parsed.data.suggestedNextStep !== undefined) updates.suggestedNextStep = parsed.data.suggestedNextStep;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.pillarId !== undefined) updates.pillarId = parsed.data.pillarId;
  if (parsed.data.milestoneId !== undefined) updates.milestoneId = parsed.data.milestoneId;
  if (parsed.data.blockerReason !== undefined) updates.blockerReason = parsed.data.blockerReason;
  if (parsed.data.blockerType !== undefined) updates.blockerType = parsed.data.blockerType;
  if (parsed.data.adjustmentReason !== undefined) updates.adjustmentReason = parsed.data.adjustmentReason;
  if (parsed.data.taskSource !== undefined) updates.taskSource = parsed.data.taskSource;

  const s = scoped(userIdFrom(req));
  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(s.tasks.owns, eq(tasksTable.id, params.data.id)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (parsed.data.status && parsed.data.status !== "pending") {
    await db.insert(progressLogsTable).values(s.progressLogs.withUser({
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      status: task.status,
      date: task.date,
    }));
  }

  res.json(UpdateTaskResponse.parse(serializeTask(task)));
});

router.post("/tasks/:id/step-back", async (req, res): Promise<void> => {
  const params = StepBackTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const s = scoped(userIdFrom(req));
  const [original] = await db.select().from(tasksTable)
    .where(and(s.tasks.owns, eq(tasksTable.id, params.data.id)));
  if (!original) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (original.stepBackDepth >= MAX_STEP_BACK_DEPTH) {
    res.status(400).json({
      error: `Cannot step back further — maximum depth of ${MAX_STEP_BACK_DEPTH} reached. Break this task down manually.`,
    });
    return;
  }

  if (original.status !== "pending" && original.status !== "stepped_back") {
    res.status(400).json({ error: "Only pending tasks can be stepped back." });
    return;
  }

  const generated = generateStepBackTask(original.title, original.stepBackDepth);

  const [prereq] = await db.insert(tasksTable).values(s.tasks.withUser({
    title: generated.title,
    category: original.category,
    whyItMatters: generated.whyItMatters,
    doneLooksLike: generated.doneLooksLike,
    suggestedNextStep: generated.suggestedNextStep,
    pillarId: original.pillarId ?? null,
    milestoneId: original.milestoneId ?? null,
    date: original.date,
    status: "pending",
    parentTaskId: original.id,
    stepBackDepth: original.stepBackDepth + 1,
    adjustmentType: "step_back",
    adjustmentReason: generated.adjustmentReason,
  })).returning();

  const [updated] = await db
    .update(tasksTable)
    .set({
      status: "stepped_back",
      adjustmentReason: `Prerequisite created: ${generated.title}`,
    })
    .where(and(s.tasks.owns, eq(tasksTable.id, original.id)))
    .returning();

  await db.insert(progressLogsTable).values(s.progressLogs.withUser({
    taskId: original.id,
    taskTitle: original.title,
    category: original.category,
    status: "stepped_back",
    date: original.date,
  }));

  res.status(201).json({
    originalTask: serializeTask(updated),
    prerequisiteTask: serializeTask(prereq),
  });
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const s = scoped(userIdFrom(req));
  const [task] = await db
    .delete(tasksTable)
    .where(and(s.tasks.owns, eq(tasksTable.id, params.data.id)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
