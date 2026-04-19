import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, weeklyPlansTable } from "@workspace/db";
import {
  CreateWeeklyPlanBody,
  UpdateWeeklyPlanBody,
  UpdateWeeklyPlanParams,
  ListWeeklyPlansQueryParams,
  ListWeeklyPlansResponse,
  UpdateWeeklyPlanResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function serializePlan(plan: typeof weeklyPlansTable.$inferSelect) {
  return {
    ...plan,
    activePillarIds: (plan.activePillarIds ?? []).map(Number),
    createdAt: plan.createdAt.toISOString(),
  };
}

router.get("/weekly", async (req, res): Promise<void> => {
  const query = ListWeeklyPlansQueryParams.safeParse(req.query);
  const weekOf = query.success && query.data.weekOf ? query.data.weekOf : getWeekStart();

  const plans = await db.select().from(weeklyPlansTable)
    .where(eq(weeklyPlansTable.weekOf, weekOf));

  res.json(ListWeeklyPlansResponse.parse(plans.map(serializePlan)));
});

router.post("/weekly", async (req, res): Promise<void> => {
  const parsed = CreateWeeklyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.insert(weeklyPlansTable).values({
    weekOf: parsed.data.weekOf,
    priorities: parsed.data.priorities,
    healthFocus: parsed.data.healthFocus ?? null,
    notes: parsed.data.notes ?? null,
    activePillarIds: parsed.data.activePillarIds.map(String),
    businessFocus: parsed.data.businessFocus ?? null,
    creativeFocus: parsed.data.creativeFocus ?? null,
    whatMovedForward: parsed.data.whatMovedForward ?? null,
    whatGotStuck: parsed.data.whatGotStuck ?? null,
    whatContinues: parsed.data.whatContinues ?? null,
    whatToDeprioritize: parsed.data.whatToDeprioritize ?? null,
    nextWeekFocus: parsed.data.nextWeekFocus ?? null,
  }).returning();

  res.status(201).json(serializePlan(plan!));
});

router.patch("/weekly/:id", async (req, res): Promise<void> => {
  const params = UpdateWeeklyPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWeeklyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.priorities !== undefined) updates.priorities = parsed.data.priorities;
  if (parsed.data.healthFocus !== undefined) updates.healthFocus = parsed.data.healthFocus;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.activePillarIds !== undefined) updates.activePillarIds = parsed.data.activePillarIds.map(String);
  if (parsed.data.businessFocus !== undefined) updates.businessFocus = parsed.data.businessFocus;
  if (parsed.data.creativeFocus !== undefined) updates.creativeFocus = parsed.data.creativeFocus;
  if (parsed.data.whatMovedForward !== undefined) updates.whatMovedForward = parsed.data.whatMovedForward;
  if (parsed.data.whatGotStuck !== undefined) updates.whatGotStuck = parsed.data.whatGotStuck;
  if (parsed.data.whatContinues !== undefined) updates.whatContinues = parsed.data.whatContinues;
  if (parsed.data.whatToDeprioritize !== undefined) updates.whatToDeprioritize = parsed.data.whatToDeprioritize;
  if (parsed.data.nextWeekFocus !== undefined) updates.nextWeekFocus = parsed.data.nextWeekFocus;

  const [plan] = await db
    .update(weeklyPlansTable)
    .set(updates)
    .where(eq(weeklyPlansTable.id, params.data.id))
    .returning();

  if (!plan) {
    res.status(404).json({ error: "Weekly plan not found" });
    return;
  }

  res.json(UpdateWeeklyPlanResponse.parse(serializePlan(plan)));
});

export default router;
