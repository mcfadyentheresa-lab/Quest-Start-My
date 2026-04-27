import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, dailyPlansTable } from "@workspace/db";
import {
  CreateDailyPlanBody,
  ListDailyPlansQueryParams,
  UpdateDailyPlanBody,
  UpdateDailyPlanParams,
} from "@workspace/api-zod";
import { scoped, userIdFrom } from "../lib/scoped";

const router: IRouter = Router();

function serializePlan(plan: typeof dailyPlansTable.$inferSelect) {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
  };
}

const MAX_DAILY_PLAN_LIMIT = 200;

router.get("/daily", async (req, res): Promise<void> => {
  const parsed = ListDailyPlansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const s = scoped(userIdFrom(req));
  const { date, limit: rawLimit } = parsed.data;

  if (date !== undefined) {
    const plans = await db.select().from(dailyPlansTable)
      .where(and(s.dailyPlans.owns, eq(dailyPlansTable.date, date)));
    res.json(plans.map(serializePlan));
    return;
  }

  const limit = rawLimit && rawLimit > 0
    ? Math.min(rawLimit, MAX_DAILY_PLAN_LIMIT)
    : MAX_DAILY_PLAN_LIMIT;

  const plans = await db.select().from(dailyPlansTable)
    .where(s.dailyPlans.owns)
    .orderBy(desc(dailyPlansTable.date))
    .limit(limit);

  res.json(plans.map(serializePlan));
});

router.post("/daily", async (req, res): Promise<void> => {
  const parsed = CreateDailyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const s = scoped(userIdFrom(req));
  const existing = await db.select({ id: dailyPlansTable.id })
    .from(dailyPlansTable)
    .where(and(s.dailyPlans.owns, eq(dailyPlansTable.date, parsed.data.date)))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "A plan for this date already exists", date: parsed.data.date });
    return;
  }

  let created: typeof dailyPlansTable.$inferSelect | undefined;
  try {
    [created] = await db.insert(dailyPlansTable)
      .values(s.dailyPlans.withUser({
        date: parsed.data.date,
        priorities: parsed.data.priorities,
      }))
      .returning();
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A plan for this date already exists", date: parsed.data.date });
      return;
    }
    throw err;
  }

  res.status(201).json(serializePlan(created!));
});

router.patch("/daily/:id", async (req, res): Promise<void> => {
  const params = UpdateDailyPlanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateDailyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateFields: Partial<typeof dailyPlansTable.$inferInsert> = {};
  if (parsed.data.priorities !== undefined) updateFields.priorities = parsed.data.priorities;

  if (Object.keys(updateFields).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const s = scoped(userIdFrom(req));
  const [updated] = await db.update(dailyPlansTable)
    .set(updateFields)
    .where(and(s.dailyPlans.owns, eq(dailyPlansTable.id, params.data.id)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Daily plan not found" });
    return;
  }

  res.json(serializePlan(updated));
});

export default router;
