import { Router, type IRouter } from "express";
import { eq, and, isNull, or, desc, ilike, type SQL } from "drizzle-orm";
import { db, tasksTable, progressLogsTable, areasTable, milestonesTable } from "@workspace/db";
import { getUserId } from "../lib/auth";
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
  SearchTasksQueryParams,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";
import { materializeRecurringTasks } from "../lib/recurring-materialize";

const router: IRouter = Router();

const MAX_STEP_BACK_DEPTH = 3;

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

router.get("/tasks", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListTasksQueryParams.safeParse(req.query);
  const today = new Date().toISOString().slice(0, 10);
  const date = query.success && query.data.date ? query.data.date : today;
  const source = query.success ? query.data.source : undefined;

  // Lazy materialization for recurring task templates. Only fires on the
  // "today" view (the daily plan); historical lookups stay read-only so
  // browsing a past day never mutates state. Source-filtered fetches
  // (e.g. ADHD home tasks) also skip — recurrences are regular work tasks.
  if (date === today && !source) {
    await materializeRecurringTasks(userId, today);
  }

  const whereClause = source
    ? and(eq(tasksTable.userId, userId), eq(tasksTable.date, date), eq(tasksTable.taskSource, source))
    : and(eq(tasksTable.userId, userId), eq(tasksTable.date, date), isNull(tasksTable.taskSource));

  const tasks = await db.select().from(tasksTable)
    .where(whereClause)
    .orderBy(tasksTable.createdAt);

  res.json(ListTasksResponse.parse(tasks.map(serializeTask)));
}));

router.post("/tasks", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    userId,
    title: parsed.data.title,
    category: parsed.data.category,
    whyItMatters: parsed.data.whyItMatters ?? null,
    doneLooksLike: parsed.data.doneLooksLike ?? null,
    suggestedNextStep: parsed.data.suggestedNextStep ?? null,
    areaId: parsed.data.areaId ?? null,
    milestoneId: parsed.data.milestoneId ?? null,
    blockerReason: parsed.data.blockerReason ?? null,
    taskSource: parsed.data.taskSource ?? null,
    // null date → inbox (brain-dumped, unscheduled)
    date: parsed.data.date ?? null,
    status: "pending",
  }).returning();

  res.status(201).json(serializeTask(task));
}));

/**
 * Inbox: tasks with no scheduled date. These are the brain-dumped items
 * the user hasn't yet scheduled to a day. Newest-first so fresh thoughts
 * sit at the top.
 */
router.get("/tasks/inbox", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(
      eq(tasksTable.userId, userId),
      isNull(tasksTable.date),
      isNull(tasksTable.taskSource),
    ))
    .orderBy(desc(tasksTable.createdAt));
  res.json(tasks.map(serializeTask));
}));

router.get("/tasks/suggestions", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const queryResult = GetTaskSuggestionsQueryParams.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ error: queryResult.error.message });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const date = queryResult.data.date ?? today;

  // Active areas ordered by priority (P1 first), then id
  const activeAreas = await db
    .select()
    .from(areasTable)
    .where(and(eq(areasTable.userId, userId), eq(areasTable.isActiveThisWeek, true)))
    .orderBy(areasTable.priority, areasTable.id);

  if (activeAreas.length === 0) {
    res.json([]);
    return;
  }

  // Tasks already on this date (non-home tasks)
  const existingTasks = await db
    .select({ areaId: tasksTable.areaId })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.date, date), isNull(tasksTable.taskSource)));

  const coveredAreaIds = new Set(
    existingTasks.flatMap(t => (t.areaId != null ? [t.areaId] : []))
  );
  const slotsAvailable = Math.max(0, 3 - existingTasks.length);

  if (slotsAvailable === 0) {
    res.json([]);
    return;
  }

  // Planned milestones for all active areas, ordered by sort_order then id
  const activeAreaIds = activeAreas.map(p => p.id);
  const allMilestones = await db
    .select()
    .from(milestonesTable)
    .where(and(eq(milestonesTable.userId, userId), eq(milestonesTable.status, "planned")))
    .orderBy(milestonesTable.sortOrder, milestonesTable.id);

  const milestonesByArea = new Map<number, typeof allMilestones>();
  for (const m of allMilestones) {
    if (!activeAreaIds.includes(m.areaId)) continue;
    if (!milestonesByArea.has(m.areaId)) milestonesByArea.set(m.areaId, []);
    milestonesByArea.get(m.areaId)!.push(m);
  }

  const suggestions: {
    title: string;
    areaId: number;
    areaName: string;
    areaColor: string | null;
    areaCategory: string | null;
    milestoneId: number;
    milestoneTitle: string;
  }[] = [];

  for (const area of activeAreas) {
    if (suggestions.length >= slotsAvailable) break;
    if (coveredAreaIds.has(area.id)) continue;

    const candidateMilestones = milestonesByArea.get(area.id) ?? [];
    // Prefer a milestone with a concrete next action; otherwise fall back to the
    // first planned milestone and use its title as the task title. This keeps
    // suggestions useful even when the user hasn't filled in nextAction yet.
    const milestone =
      candidateMilestones.find(m => m.nextAction && m.nextAction.trim()) ??
      candidateMilestones[0];
    if (!milestone) continue;

    const title =
      milestone.nextAction && milestone.nextAction.trim()
        ? milestone.nextAction.trim()
        : milestone.title;

    suggestions.push({
      title,
      areaId: area.id,
      areaName: area.name,
      areaColor: area.color ?? null,
      areaCategory: area.category ?? null,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
    });
  }

  res.json(suggestions);
}));

/**
 * Flat task search across all of the user's tasks. Powers the Capture
 * page (Unprocessed / All tasks / Completed sub-tabs + free-text + chips).
 *
 * Newest-first by createdAt. Hard cap at 500 rows so a search on a huge
 * library doesn't accidentally return everything.
 */
router.get("/tasks/search", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = SearchTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { bucket = "all", q, areaId, status, energy, limit = 100 } = parsed.data;

  const filters: SQL[] = [eq(tasksTable.userId, userId)];

  // Source scoping. We surface user-entered work only: tasks with no
  // source (legacy/manual) plus tasks captured via the new Capture flow.
  // AI-driven home module check-ins (taskSource = 'home') stay out so
  // they don't pollute the trust-layer view.
  const sourceClause = or(
    isNull(tasksTable.taskSource),
    eq(tasksTable.taskSource, "capture"),
  );
  if (sourceClause) filters.push(sourceClause);

  if (bucket === "unprocessed") {
    // Things that still need a decision: undated OR flagged for review.
    // Done tasks are always excluded from this bucket.
    const unprocessedClause = and(
      or(isNull(tasksTable.date), eq(tasksTable.needsReview, true)),
      eq(tasksTable.status, "pending"),
    );
    if (unprocessedClause) filters.push(unprocessedClause);
  } else if (bucket === "completed") {
    filters.push(eq(tasksTable.status, "done"));
  }

  if (status) filters.push(eq(tasksTable.status, status));
  if (areaId != null) filters.push(eq(tasksTable.areaId, areaId));
  if (energy) filters.push(eq(tasksTable.energy, energy));

  if (q && q.trim().length > 0) {
    const needle = `%${q.trim()}%`;
    const searchClause = or(
      ilike(tasksTable.title, needle),
      ilike(tasksTable.whyItMatters, needle),
      ilike(tasksTable.doneLooksLike, needle),
      ilike(tasksTable.originalDump, needle),
    );
    if (searchClause) filters.push(searchClause);
  }

  const rows = await db
    .select()
    .from(tasksTable)
    .where(and(...filters))
    .orderBy(desc(tasksTable.createdAt))
    .limit(Math.min(limit, 500));

  res.json(rows.map(serializeTask));
}));

router.patch("/tasks/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
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
  if (parsed.data.areaId !== undefined) updates.areaId = parsed.data.areaId;
  if (parsed.data.milestoneId !== undefined) updates.milestoneId = parsed.data.milestoneId;
  if (parsed.data.blockerReason !== undefined) updates.blockerReason = parsed.data.blockerReason;
  if (parsed.data.blockerType !== undefined) updates.blockerType = parsed.data.blockerType;
  if (parsed.data.adjustmentReason !== undefined) updates.adjustmentReason = parsed.data.adjustmentReason;
  if (parsed.data.taskSource !== undefined) updates.taskSource = parsed.data.taskSource;
  // Allow scheduling an inbox task (date = '2026-05-03') or moving a
  // scheduled task back to the inbox (date = null).
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if (parsed.data.energy !== undefined) updates.energy = parsed.data.energy;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (parsed.data.status && parsed.data.status !== "pending") {
    await db.insert(progressLogsTable).values({
      userId,
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      status: task.status,
      // Inbox tasks have no date; log today so the progress feed still
      // gets a row.
      date: task.date ?? new Date().toISOString().slice(0, 10),
    });
  }

  res.json(UpdateTaskResponse.parse(serializeTask(task)));
}));

router.post("/tasks/:id/step-back", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = StepBackTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [original] = await db.select().from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)));
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

  const [prereq] = await db.insert(tasksTable).values({
    userId,
    title: generated.title,
    category: original.category,
    whyItMatters: generated.whyItMatters,
    doneLooksLike: generated.doneLooksLike,
    suggestedNextStep: generated.suggestedNextStep,
    areaId: original.areaId ?? null,
    milestoneId: original.milestoneId ?? null,
    date: original.date,
    status: "pending",
    parentTaskId: original.id,
    stepBackDepth: original.stepBackDepth + 1,
    adjustmentType: "step_back",
    adjustmentReason: generated.adjustmentReason,
  }).returning();

  const [updated] = await db
    .update(tasksTable)
    .set({
      status: "stepped_back",
      adjustmentReason: `Prerequisite created: ${generated.title}`,
    })
    .where(and(eq(tasksTable.id, original.id), eq(tasksTable.userId, userId)))
    .returning();

  await db.insert(progressLogsTable).values({
    userId,
    taskId: original.id,
    taskTitle: original.title,
    category: original.category,
    status: "stepped_back",
    date: original.date ?? new Date().toISOString().slice(0, 10),
  });

  res.status(201).json({
    originalTask: serializeTask(updated),
    prerequisiteTask: serializeTask(prereq),
  });
}));

router.delete("/tasks/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
