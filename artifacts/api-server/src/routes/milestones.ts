import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, milestonesTable } from "@workspace/db";
import {
  ListMilestonesQueryParams,
  ListMilestonesResponse,
  CreateMilestoneBody,
  UpdateMilestoneParams,
  UpdateMilestoneBody,
  UpdateMilestoneResponse,
  DeleteMilestoneParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeMilestone(m: typeof milestonesTable.$inferSelect) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/milestones", async (req, res): Promise<void> => {
  const query = ListMilestonesQueryParams.safeParse(req.query);
  const pillarId = query.success && query.data.pillarId ? query.data.pillarId : undefined;

  const milestones = await db
    .select()
    .from(milestonesTable)
    .where(pillarId ? eq(milestonesTable.pillarId, pillarId) : undefined)
    .orderBy(milestonesTable.sortOrder, milestonesTable.createdAt);

  res.json(ListMilestonesResponse.parse(milestones.map(serializeMilestone)));
});

router.post("/milestones", async (req, res): Promise<void> => {
  const parsed = CreateMilestoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [milestone] = await db.insert(milestonesTable).values({
    pillarId: parsed.data.pillarId,
    title: parsed.data.title,
    status: parsed.data.status ?? "planned",
    priority: parsed.data.priority ?? null,
    targetDate: parsed.data.targetDate ?? null,
    description: parsed.data.description ?? null,
    nextAction: parsed.data.nextAction ?? null,
    sortOrder: parsed.data.sortOrder ?? 0,
  }).returning();

  res.status(201).json(serializeMilestone(milestone!));
});

router.patch("/milestones/:id", async (req, res): Promise<void> => {
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

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.targetDate !== undefined) updates.targetDate = parsed.data.targetDate;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.nextAction !== undefined) updates.nextAction = parsed.data.nextAction;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;

  const [milestone] = await db
    .update(milestonesTable)
    .set(updates)
    .where(eq(milestonesTable.id, params.data.id))
    .returning();

  if (!milestone) {
    res.status(404).json({ error: "Milestone not found" });
    return;
  }

  res.json(UpdateMilestoneResponse.parse(serializeMilestone(milestone)));
});

router.delete("/milestones/:id", async (req, res): Promise<void> => {
  const params = DeleteMilestoneParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const [milestone] = await db
      .delete(milestonesTable)
      .where(eq(milestonesTable.id, params.data.id))
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
});

export default router;
