import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pillarsTable } from "@workspace/db";
import {
  CreatePillarBody,
  UpdatePillarBody,
  UpdatePillarParams,
  ListPillarsResponse,
  UpdatePillarResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pillars", async (req, res): Promise<void> => {
  const pillars = await db.select().from(pillarsTable).orderBy(pillarsTable.id);
  res.json(ListPillarsResponse.parse(pillars.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  }))));
});

router.post("/pillars", async (req, res): Promise<void> => {
  const parsed = CreatePillarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pillar] = await db.insert(pillarsTable).values({
    name: parsed.data.name,
    priority: parsed.data.priority,
    description: parsed.data.description ?? null,
    isActiveThisWeek: parsed.data.isActiveThisWeek,
    color: parsed.data.color ?? null,
  }).returning();

  res.status(201).json({
    ...pillar,
    createdAt: pillar.createdAt.toISOString(),
  });
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

  const [pillar] = await db
    .update(pillarsTable)
    .set(updates)
    .where(eq(pillarsTable.id, params.data.id))
    .returning();

  if (!pillar) {
    res.status(404).json({ error: "Pillar not found" });
    return;
  }

  res.json(UpdatePillarResponse.parse({
    ...pillar,
    createdAt: pillar.createdAt.toISOString(),
  }));
});

export default router;
