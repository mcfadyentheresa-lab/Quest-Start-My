import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, pillarsTable } from "@workspace/db";
import {
  CreatePillarBody,
  UpdatePillarBody,
  UpdatePillarParams,
  ListPillarsResponse,
  UpdatePillarResponse,
} from "@workspace/api-zod";
import { scoped, userIdFrom } from "../lib/scoped";

const router: IRouter = Router();

function serializePillar(p: typeof pillarsTable.$inferSelect) {
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/pillars", async (req, res): Promise<void> => {
  const s = scoped(userIdFrom(req));
  const pillars = await db.select().from(pillarsTable).where(s.pillars.owns).orderBy(pillarsTable.id);
  res.json(ListPillarsResponse.parse(pillars.map(serializePillar)));
});

router.post("/pillars", async (req, res): Promise<void> => {
  const parsed = CreatePillarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const s = scoped(userIdFrom(req));
  const [pillar] = await db.insert(pillarsTable).values(s.pillars.withUser({
    name: parsed.data.name,
    priority: parsed.data.priority,
    description: parsed.data.description ?? null,
    isActiveThisWeek: parsed.data.isActiveThisWeek,
    color: parsed.data.color ?? null,
    portfolioStatus: parsed.data.portfolioStatus ?? null,
    featureTag: parsed.data.featureTag ?? null,
    category: parsed.data.category ?? null,
  })).returning();

  res.status(201).json(serializePillar(pillar!));
});

router.patch("/pillars/:id", async (req, res): Promise<void> => {
  const params = UpdatePillarParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePillarBody.safeParse(req.body);
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

  const s = scoped(userIdFrom(req));
  const [pillar] = await db
    .update(pillarsTable)
    .set(updates)
    .where(and(s.pillars.owns, eq(pillarsTable.id, params.data.id)))
    .returning();

  if (!pillar) {
    res.status(404).json({ error: "Pillar not found" });
    return;
  }

  res.json(UpdatePillarResponse.parse(serializePillar(pillar)));
});

export default router;
