import { Router, type IRouter } from "express";
import { eq, desc, and, ne } from "drizzle-orm";
import { db, monthlyReviewsTable } from "@workspace/db";
import {
  ListMonthlyReviewsResponse,
  CreateMonthlyReviewBody,
  UpdateMonthlyReviewBody,
  UpdateMonthlyReviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const serializeReview = (r: typeof monthlyReviewsTable.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  topPrioritiesNextMonth: r.topPrioritiesNextMonth ?? null,
});

router.get("/monthly", async (req, res): Promise<void> => {
  const reviews = await db.select()
    .from(monthlyReviewsTable)
    .orderBy(desc(monthlyReviewsTable.monthOf));

  res.json(ListMonthlyReviewsResponse.parse(reviews.map(serializeReview)));
});

router.post("/monthly", async (req, res): Promise<void> => {
  const parsed = CreateMonthlyReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;

  // Check for duplicate monthOf (UNIQUE constraint — return 409 instead of DB error)
  const existing = await db.select({ id: monthlyReviewsTable.id })
    .from(monthlyReviewsTable)
    .where(eq(monthlyReviewsTable.monthOf, body.monthOf))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "A review for this month already exists", monthOf: body.monthOf });
    return;
  }

  let created: typeof monthlyReviewsTable.$inferSelect | undefined;
  try {
    [created] = await db.insert(monthlyReviewsTable)
      .values({
        monthOf: body.monthOf,
        whatMoved: body.whatMoved ?? null,
        pillarsAdvanced: body.pillarsAdvanced ?? null,
        milestonesCompleted: body.milestonesCompleted ?? null,
        whatDelayed: body.whatDelayed ?? null,
        whatToPause: body.whatToPause ?? null,
        topPrioritiesNextMonth: body.topPrioritiesNextMonth ?? null,
      })
      .returning();
  } catch (err: any) {
    // Unique constraint violation (race condition between pre-check and insert)
    if (err?.code === "23505") {
      res.status(409).json({ error: "A review for this month already exists", monthOf: body.monthOf });
      return;
    }
    throw err;
  }

  res.status(201).json(serializeReview(created!));
});

router.patch("/monthly/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateMonthlyReviewBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const body = bodyParsed.data;

  // Check for monthOf conflict before updating (excludes current record)
  if ("monthOf" in body && body.monthOf !== undefined) {
    const conflict = await db.select({ id: monthlyReviewsTable.id })
      .from(monthlyReviewsTable)
      .where(and(eq(monthlyReviewsTable.monthOf, body.monthOf), ne(monthlyReviewsTable.id, id)))
      .limit(1);
    if (conflict.length > 0) {
      res.status(409).json({ error: "A review for this month already exists", monthOf: body.monthOf });
      return;
    }
  }

  const updateFields: Partial<typeof monthlyReviewsTable.$inferInsert> = {};
  if ("monthOf" in body && body.monthOf !== undefined) updateFields.monthOf = body.monthOf;
  if ("whatMoved" in body) updateFields.whatMoved = body.whatMoved ?? null;
  if ("pillarsAdvanced" in body) updateFields.pillarsAdvanced = body.pillarsAdvanced ?? null;
  if ("milestonesCompleted" in body) updateFields.milestonesCompleted = body.milestonesCompleted ?? null;
  if ("whatDelayed" in body) updateFields.whatDelayed = body.whatDelayed ?? null;
  if ("whatToPause" in body) updateFields.whatToPause = body.whatToPause ?? null;
  if ("topPrioritiesNextMonth" in body) updateFields.topPrioritiesNextMonth = body.topPrioritiesNextMonth ?? null;

  if (Object.keys(updateFields).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db.update(monthlyReviewsTable)
    .set(updateFields)
    .where(eq(monthlyReviewsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Monthly review not found" });
    return;
  }

  res.json(UpdateMonthlyReviewResponse.parse(serializeReview(updated)));
});

export default router;
