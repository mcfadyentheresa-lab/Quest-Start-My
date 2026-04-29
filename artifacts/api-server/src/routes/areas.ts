import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, areasTable } from "@workspace/db";
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
    featureTag: parsed.data.featureTag ?? null,
    category: parsed.data.category ?? null,
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
  if (parsed.data.currentStage !== undefined) updates.currentStage = parsed.data.currentStage;
  if (parsed.data.whyItMatters !== undefined) updates.whyItMatters = parsed.data.whyItMatters;
  if (parsed.data.nowFocus !== undefined) updates.nowFocus = parsed.data.nowFocus;
  if (parsed.data.nextFocus !== undefined) updates.nextFocus = parsed.data.nextFocus;
  if (parsed.data.laterFocus !== undefined) updates.laterFocus = parsed.data.laterFocus;
  if (parsed.data.blockers !== undefined) updates.blockers = parsed.data.blockers;
  if (parsed.data.lastUpdated !== undefined) updates.lastUpdated = parsed.data.lastUpdated;
  if (parsed.data.featureTag !== undefined) updates.featureTag = parsed.data.featureTag;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;

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

export default router;
