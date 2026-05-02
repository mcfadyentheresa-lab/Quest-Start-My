import { Router, type IRouter } from "express";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db, areasTable, tasksTable } from "@workspace/db";
import {
  CreateAreaBody,
  UpdateAreaBody,
  UpdateAreaParams,
  ListAreasResponse,
  UpdateAreaResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

function serializeArea(p: typeof areasTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/areas", asyncHandler(async (req, res): Promise<void> => {
  const areas = await db.select().from(areasTable).orderBy(areasTable.id);
  res.json(ListAreasResponse.parse(areas.map(serializeArea)));
}));

router.post("/areas", asyncHandler(async (req, res): Promise<void> => {
  const parsed = CreateAreaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [area] = await db.insert(areasTable).values({
    name: parsed.data.name,
    priority: parsed.data.priority,
    description: parsed.data.description ?? null,
    isActiveThisWeek: parsed.data.isActiveThisWeek,
    color: parsed.data.color ?? null,
    portfolioStatus: parsed.data.portfolioStatus ?? null,
    category: parsed.data.category ?? null,
    honestNote: parsed.data.honestNote ?? null,
  }).returning();

  res.status(201).json(serializeArea(area!));
}));

router.patch("/areas/:id", asyncHandler(async (req, res): Promise<void> => {
  const params = UpdateAreaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAreaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isActiveThisWeek !== undefined) updates.isActiveThisWeek = parsed.data.isActiveThisWeek;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.portfolioStatus !== undefined) updates.portfolioStatus = parsed.data.portfolioStatus;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.honestNote !== undefined) updates.honestNote = parsed.data.honestNote;

  const [area] = await db
    .update(areasTable)
    .set(updates)
    .where(eq(areasTable.id, params.data.id))
    .returning();

  if (!area) {
    res.status(404).json({ error: "Area not found" });
    return;
  }

  res.json(UpdateAreaResponse.parse(serializeArea(area)));
}));

/**
 * Brain-dump endpoint for the per-area page.
 *
 * Returns every regular task (taskSource IS NULL) belonging to the given
 * area, regardless of date or status. The dashboard /tasks endpoint is
 * date-bounded; this is the "everything for area X" view that the per-area
 * page needs so the user can see and manage their full backlog for that
 * area at once.
 *
 * Newest-first by createdAt so newly brain-dumped tasks appear at the top.
 */
router.get("/areas/:id/tasks", asyncHandler(async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid area id" });
    return;
  }

  const [area] = await db.select().from(areasTable).where(eq(areasTable.id, id)).limit(1);
  if (!area) {
    res.status(404).json({ error: "Area not found" });
    return;
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.areaId, id), isNull(tasksTable.taskSource)))
    .orderBy(desc(tasksTable.createdAt));

  res.json(tasks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
}));

export default router;
