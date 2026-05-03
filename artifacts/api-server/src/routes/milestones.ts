import { Router, type IRouter } from "express";
import { and, desc, eq, asc, inArray } from "drizzle-orm";
import { db, milestonesTable, tasksTable, areasTable } from "@workspace/db";
import {
  ListMilestonesQueryParams,
  ListMilestonesResponse,
  CreateMilestoneBody,
  BulkCreateMilestonesBody,
  UpdateMilestoneParams,
  UpdateMilestoneBody,
  UpdateMilestoneResponse,
  DeleteMilestoneParams,
  BreakdownMilestoneParams,
  ReorderMilestoneStepsParams,
  ReorderMilestoneStepsBody,
  BulkCreateMilestoneStepsParams,
  BulkCreateMilestoneStepsBody,
  bulkCreateMilestoneStepsBodyTitlesItemMax,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";
import { buildBreakdownSteps, fallbackSteps } from "../lib/breakdown/ai";
import { logger } from "../lib/logger";
import { readOpenAiApiKey } from "../lib/openai-key";
import { getUserId } from "../lib/auth";
import { invalidateYearRibbonForUser } from "./year-ribbon";

const router: IRouter = Router();

function serializeMilestone(
  m: typeof milestonesTable.$inferSelect,
  // Pass `undefined` when the prerequisite hasn't been resolved yet (in
  // which case the safe default is that no hold is active). Pass `null`
  // explicitly when the prerequisite exists but is not complete.
  prereqCompletedAt?: Date | null,
) {
  const isOnHold =
    m.holdUntilMilestoneId !== null &&
    m.holdUntilMilestoneId !== undefined &&
    prereqCompletedAt !== undefined &&
    prereqCompletedAt === null;
  return {
    ...m,
    completedAt: m.completedAt ? m.completedAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    isOnHold,
  };
}

// Resolve a single milestone's isOnHold by fetching its prereq if any.
async function serializeMilestoneWithHold(m: typeof milestonesTable.$inferSelect) {
  if (m.holdUntilMilestoneId === null || m.holdUntilMilestoneId === undefined) {
    return serializeMilestone(m, null);
  }
  const [prereq] = await db
    .select({ completedAt: milestonesTable.completedAt })
    .from(milestonesTable)
    .where(and(eq(milestonesTable.id, m.holdUntilMilestoneId), eq(milestonesTable.userId, m.userId)));
  return serializeMilestone(m, prereq?.completedAt ?? null);
}

// Resolve isOnHold for a list of milestones in one query. Returns a Map of
// milestoneId -> the prerequisite's completedAt (Date | null). Milestones
// without a holdUntilMilestoneId are absent from the map.
async function resolvePrereqCompletion(
  rows: ReadonlyArray<typeof milestonesTable.$inferSelect>,
): Promise<Map<number, Date | null>> {
  const ids = Array.from(
    new Set(
      rows
        .map((r) => r.holdUntilMilestoneId)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const out = new Map<number, Date | null>();
  if (ids.length === 0) return out;
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const prereqs = await db
    .select({ id: milestonesTable.id, completedAt: milestonesTable.completedAt })
    .from(milestonesTable)
    .where(and(inArray(milestonesTable.id, ids), inArray(milestonesTable.userId, userIds)));
  for (const p of prereqs) out.set(p.id, p.completedAt ?? null);
  return out;
}

// Validate a proposed holdUntilMilestoneId for a given milestone. Returns
// an error string when invalid (caller maps to 400 / 409); null when ok.
// Pass the milestone's areaId so the same-area rule can be checked, and the
// id of the milestone being updated (or null for inserts) so cycle detection
// can refuse a chain that loops back to it.
async function validateHoldUntil(args: {
  thisMilestoneId: number | null;
  thisAreaId: number;
  holdUntilMilestoneId: number | null;
  userId: string;
}): Promise<{ status: 400 | 409; error: string } | null> {
  const { thisMilestoneId, thisAreaId, holdUntilMilestoneId, userId } = args;
  if (holdUntilMilestoneId === null) return null;
  if (thisMilestoneId !== null && holdUntilMilestoneId === thisMilestoneId) {
    return { status: 400, error: "A goal cannot hold on itself." };
  }
  const [target] = await db
    .select({
      id: milestonesTable.id,
      areaId: milestonesTable.areaId,
      holdUntilMilestoneId: milestonesTable.holdUntilMilestoneId,
    })
    .from(milestonesTable)
    .where(and(eq(milestonesTable.id, holdUntilMilestoneId), eq(milestonesTable.userId, userId)));
  if (!target) {
    return { status: 400, error: "Hold target does not exist." };
  }
  if (target.areaId !== thisAreaId) {
    return { status: 400, error: "Hold target must be in the same area." };
  }
  // Walk the chain from the proposed target. If we visit thisMilestoneId,
  // it's a cycle.
  const visited = new Set<number>();
  let cursor: number | null = target.holdUntilMilestoneId;
  while (cursor !== null) {
    if (thisMilestoneId !== null && cursor === thisMilestoneId) {
      return { status: 409, error: "That hold would create a cycle." };
    }
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const [next] = await db
      .select({ holdUntilMilestoneId: milestonesTable.holdUntilMilestoneId })
      .from(milestonesTable)
      .where(and(eq(milestonesTable.id, cursor), eq(milestonesTable.userId, userId)));
    if (!next) break;
    cursor = next.holdUntilMilestoneId;
  }
  return null;
}

function serializeTask(t: typeof tasksTable.$inferSelect) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

router.get("/milestones", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListMilestonesQueryParams.safeParse(req.query);
  const areaId = query.success && query.data.areaId ? query.data.areaId : undefined;

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(
      areaId
        ? and(eq(milestonesTable.userId, userId), eq(milestonesTable.areaId, areaId))
        : eq(milestonesTable.userId, userId),
    )
    .orderBy(milestonesTable.sortOrder, milestonesTable.createdAt);

  const prereqMap = await resolvePrereqCompletion(milestones);
  const serialized = milestones.map((m) => {
    if (m.holdUntilMilestoneId === null || m.holdUntilMilestoneId === undefined) {
      return serializeMilestone(m, null);
    }
    return serializeMilestone(m, prereqMap.get(m.holdUntilMilestoneId) ?? null);
  });
  res.json(ListMilestonesResponse.parse(serialized));
}));

router.post("/milestones", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify area belongs to this user before allowing milestone creation under it.
  const [parentArea] = await db
    .select({ id: areasTable.id })
    .from(areasTable)
    .where(and(eq(areasTable.id, parsed.data.areaId), eq(areasTable.userId, userId)));
  if (!parentArea) {
    res.status(404).json({ error: "Area not found" });
    return;
  }

  if (parsed.data.holdUntilMilestoneId !== undefined && parsed.data.holdUntilMilestoneId !== null) {
    const validation = await validateHoldUntil({
      thisMilestoneId: null,
      thisAreaId: parsed.data.areaId,
      holdUntilMilestoneId: parsed.data.holdUntilMilestoneId,
      userId,
    });
    if (validation) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }
  }

  const [milestone] = await db.insert(milestonesTable).values({
    userId,
    areaId: parsed.data.areaId,
    title: parsed.data.title,
    status: parsed.data.status ?? "planned",
    priority: parsed.data.priority ?? null,
    targetDate: parsed.data.targetDate ?? null,
    description: parsed.data.description ?? null,
    nextAction: parsed.data.nextAction ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
    mode: parsed.data.mode ?? "ordered",
    completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null,
    holdUntilMilestoneId: parsed.data.holdUntilMilestoneId ?? null,
  }).returning();

  res.status(201).json(await serializeMilestoneWithHold(milestone!));
}));

router.post("/milestones/bulk", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = BulkCreateMilestonesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { areaId, titles } = parsed.data;

  // Verify the area belongs to this user.
  const [parentArea] = await db
    .select({ id: areasTable.id })
    .from(areasTable)
    .where(and(eq(areasTable.id, areaId), eq(areasTable.userId, userId)));
  if (!parentArea) {
    res.status(404).json({ error: "Area not found" });
    return;
  }

  // Get current max sort_order for this area so new ones go at the bottom
  const existing = await db
    .select({ sortOrder: milestonesTable.sortOrder })
    .from(milestonesTable)
    .where(and(eq(milestonesTable.userId, userId), eq(milestonesTable.areaId, areaId)));

  const maxOrder = existing.reduce((max, m) => Math.max(max, m.sortOrder ?? 0), -1);

  const rows = titles.map((title, i) => ({
    userId,
    areaId,
    title: title.trim(),
    status: "planned" as const,
    sortOrder: maxOrder + 1 + i,
  }));

  const created = await db.insert(milestonesTable).values(rows).returning();

  // bulk create never sets holdUntilMilestoneId, so isOnHold is always false.
  res.status(201).json(created.map((m) => serializeMilestone(m, null)));
}));

router.patch("/milestones/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Validate holdUntilMilestoneId against the existing row's areaId before
  // applying updates, since cycle / same-area checks need to know the
  // milestone's id and area.
  if (parsed.data.holdUntilMilestoneId !== undefined && parsed.data.holdUntilMilestoneId !== null) {
    const [existing] = await db
      .select({ id: milestonesTable.id, areaId: milestonesTable.areaId })
      .from(milestonesTable)
      .where(and(eq(milestonesTable.id, params.data.id), eq(milestonesTable.userId, userId)));
    if (!existing) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }
    const validation = await validateHoldUntil({
      thisMilestoneId: existing.id,
      thisAreaId: existing.areaId,
      holdUntilMilestoneId: parsed.data.holdUntilMilestoneId,
      userId,
    });
    if (validation) {
      res.status(validation.status).json({ error: validation.error });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.targetDate !== undefined) updates.targetDate = parsed.data.targetDate;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.nextAction !== undefined) updates.nextAction = parsed.data.nextAction;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.mode !== undefined) updates.mode = parsed.data.mode;
  if (parsed.data.completedAt !== undefined) {
    updates.completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : null;
  }
  if (parsed.data.holdUntilMilestoneId !== undefined) {
    updates.holdUntilMilestoneId = parsed.data.holdUntilMilestoneId;
  }
  updates.updatedAt = new Date();

  const [milestone] = await db
    .update(milestonesTable)
    .set(updates)
    .where(and(eq(milestonesTable.id, params.data.id), eq(milestonesTable.userId, userId)))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }

  // A milestone update can move (targetDate), recolor (status), or otherwise
  // change how the goal pill renders in the year view. The year-ribbon
  // route caches per (year,userId) for 5 minutes, so flush that user's
  // cached years now.
  invalidateYearRibbonForUser(userId);

  res.json(UpdateMilestoneResponse.parse(await serializeMilestoneWithHold(milestone)));
}));

// Phase 3: AI breakdown of a goal into 5–8 ordered steps.
// Refuses if the goal already has tasks (409). Falls back to a deterministic
// generic plan if no OpenAI key is configured (see lib/openai-key.ts) or
// the LLM call fails — UI never sees a hard error.
router.post("/milestones/:id/breakdown", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = BreakdownMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [milestone] = await db
    .select()
    .from(milestonesTable)
    .where(and(eq(milestonesTable.id, params.data.id), eq(milestonesTable.userId, userId)));

  if (!milestone) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  // 409 if the goal already has steps — the user should clear or edit them
  // rather than have the AI duplicate work.
  const existing = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.milestoneId, milestone.id), eq(tasksTable.userId, userId)));

  if (existing.length > 0) {
    res.status(409).json({ error: "This goal already has steps. Clear them first." });
    return;
  }

  // Resolve richer area context for the prompt.
  const [area] = await db
    .select({
      name: areasTable.name,
      description: areasTable.description,
      priority: areasTable.priority,
      isActiveThisWeek: areasTable.isActiveThisWeek,
    })
    .from(areasTable)
    .where(and(eq(areasTable.id, milestone.areaId), eq(areasTable.userId, userId)));

  // Existing step titles on this goal (none right now since we 409'd above,
  // but kept generic so a future "add more steps" path can reuse the same
  // builder without new wiring).
  const existingStepRows = await db
    .select({ title: tasksTable.title })
    .from(tasksTable)
    .where(and(eq(tasksTable.milestoneId, milestone.id), eq(tasksTable.userId, userId)))
    .orderBy(asc(tasksTable.sortOrder));
  const existingStepTitles = existingStepRows.map((r) => r.title);

  // 5 most recently completed tasks in this area as a "rhythm and language"
  // signal for the model.
  const recentlyCompletedRows = await db
    .select({ title: tasksTable.title, createdAt: tasksTable.createdAt })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        eq(tasksTable.areaId, milestone.areaId),
        eq(tasksTable.status, "done"),
      ),
    )
    .orderBy(desc(tasksTable.createdAt))
    .limit(5);
  const recentlyCompletedTitles = recentlyCompletedRows.map((r) => r.title);

  const todayIso = new Date().toISOString().slice(0, 10);

  let steps: string[];
  const apiKey = readOpenAiApiKey();
  if (apiKey) {
    try {
      steps = await buildBreakdownSteps(
        {
          goalTitle: milestone.title,
          goalDescription: milestone.description ?? null,
          areaName: area?.name ?? null,
          areaDescription: area?.description ?? null,
          areaPriority: area?.priority ?? null,
          areaActiveThisWeek: area?.isActiveThisWeek ?? null,
          existingStepTitles,
          recentlyCompletedTitles,
          todayIso,
        },
        { apiKey: apiKey.trim() },
      );
    } catch (err) {
      logger.warn({ err: String(err) }, "AI breakdown failed, falling back");
      steps = fallbackSteps({ goalTitle: milestone.title, areaName: area?.name ?? null });
    }
  } else {
    steps = fallbackSteps({ goalTitle: milestone.title, areaName: area?.name ?? null });
  }

  const rows = steps.map((title, i) => ({
    userId,
    title,
    category: "business" as const,
    status: "pending" as const,
    areaId: milestone.areaId,
    milestoneId: milestone.id,
    date: todayIso,
    sortOrder: i + 1,
  }));

  const created = await db.insert(tasksTable).values(rows).returning();
  res.status(201).json(created.map(serializeTask));
}));

// Phase 3: reorder steps inside a goal. Body is an ordered array of task ids;
// each task's sortOrder is set to its index. Tasks not belonging to this
// milestone are silently ignored (defensive — UI shouldn't send them).
router.patch("/milestones/:id/step-order", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = ReorderMilestoneStepsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ReorderMilestoneStepsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [milestone] = await db
    .select({ id: milestonesTable.id })
    .from(milestonesTable)
    .where(and(eq(milestonesTable.id, params.data.id), eq(milestonesTable.userId, userId)));

  if (!milestone) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const { taskIds } = body.data;
  if (taskIds.length === 0) {
    res.json([]);
    return;
  }

  // Only update tasks that actually belong to this milestone.
  const owned = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        eq(tasksTable.milestoneId, milestone.id),
        inArray(tasksTable.id, taskIds),
      ),
    );
  const ownedSet = new Set(owned.map((r) => r.id));

  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i]!;
    if (!ownedSet.has(taskId)) continue;
    await db
      .update(tasksTable)
      .set({ sortOrder: i + 1 })
      .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)));
  }

  const refreshed = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.milestoneId, milestone.id)))
    .orderBy(asc(tasksTable.sortOrder));

  res.json(refreshed.map(serializeTask));
}));

// Append many steps to a goal in one shot. Frontend sends a parsed list
// (paste → split on newlines/bullets/commas → edit), and these become tasks
// with sortOrder continuing after any existing steps.
router.post("/milestones/:id/steps/bulk", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = BulkCreateMilestoneStepsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = req.body as { titles?: unknown };
  const rawTitles = Array.isArray(body?.titles) ? body.titles : null;
  if (rawTitles === null) {
    res.status(400).json({ error: "titles must be an array" });
    return;
  }

  // Trim and drop empties.
  const trimmed = rawTitles.map((t) => (typeof t === "string" ? t.trim() : ""));
  const filtered: string[] = [];
  const filteredOriginalIndices: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const t = trimmed[i]!;
    if (t.length > 0) {
      filtered.push(t);
      filteredOriginalIndices.push(i);
    }
  }

  if (filtered.length === 0) {
    res.status(400).json({ error: "titles must contain at least one non-empty step" });
    return;
  }

  // Length check — return offending indices (referencing the post-trim list)
  // so the client can highlight problem rows.
  const tooLong: number[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i]!.length > bulkCreateMilestoneStepsBodyTitlesItemMax) {
      tooLong.push(i);
    }
  }
  if (tooLong.length > 0) {
    res.status(400).json({
      error: `One or more steps exceed the ${bulkCreateMilestoneStepsBodyTitlesItemMax}-character limit.`,
      offendingIndices: tooLong,
    });
    return;
  }

  // Final shape parse (catches anything we missed — array length cap, etc.)
  const parsed = BulkCreateMilestoneStepsBody.safeParse({ titles: filtered });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const milestoneId = params.data.id;

  const [milestone] = await db
    .select()
    .from(milestonesTable)
    .where(and(eq(milestonesTable.id, milestoneId), eq(milestonesTable.userId, userId)));

  if (!milestone) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  // Append after the highest existing sortOrder for this milestone's steps.
  const existing = await db
    .select({ sortOrder: tasksTable.sortOrder })
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.milestoneId, milestoneId)));

  const maxOrder = existing.reduce(
    (max, row) => Math.max(max, row.sortOrder ?? 0),
    0,
  );

  const today = new Date().toISOString().slice(0, 10);
  const rows = parsed.data.titles.map((title, i) => ({
    userId,
    title,
    category: "business" as const,
    status: "pending" as const,
    areaId: milestone.areaId,
    milestoneId: milestone.id,
    date: today,
    sortOrder: maxOrder + i + 1,
  }));

  const created = await db.insert(tasksTable).values(rows).returning();
  res.status(201).json(created.map(serializeTask));
}));

router.delete("/milestones/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const [milestone] = await db
      .delete(milestonesTable)
      .where(and(eq(milestonesTable.id, params.data.id), eq(milestonesTable.userId, userId)))
      .returning();

    if (!milestone) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }

    res.sendStatus(204);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("foreign key") || msg.includes("violates")) {
      res.status(409).json({ error: "Cannot delete milestone: it is still referenced by tasks." });
    } else {
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  }
}));

export default router;
