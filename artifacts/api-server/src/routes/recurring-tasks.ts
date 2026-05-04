import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, recurringTasksTable } from "@workspace/db";
import { getUserId } from "../lib/auth";
import {
  CreateRecurringTaskBody,
  UpdateRecurringTaskBody,
  UpdateRecurringTaskParams,
  DeleteRecurringTaskParams,
  ListRecurringTasksResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

type RecurringTaskRow = typeof recurringTasksTable.$inferSelect;

// `weekdays` is stored as JSON-encoded text (see schema/recurring_tasks.ts).
// All API surfaces speak the parsed array form, so we serialize at the edges.
function parseWeekdays(stored: string | null): number[] | null {
  if (stored == null || stored === "") return null;
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
      return parsed as number[];
    }
  } catch {
    // fall through
  }
  return null;
}

function stringifyWeekdays(arr: number[] | null | undefined): string | null {
  if (arr == null) return null;
  // Normalize: dedupe + sort so stored representation is canonical.
  const cleaned = [...new Set(arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  return JSON.stringify(cleaned);
}

function serialize(row: RecurringTaskRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    areaId: row.areaId,
    milestoneId: row.milestoneId,
    frequency: row.frequency,
    weekdays: parseWeekdays(row.weekdays),
    dayOfMonth: row.dayOfMonth,
    startDate: row.startDate,
    lastMaterializedDate: row.lastMaterializedDate,
    pausedAt: row.pausedAt ? row.pausedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/recurring-tasks", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const rows = await db
    .select()
    .from(recurringTasksTable)
    .where(eq(recurringTasksTable.userId, userId))
    .orderBy(recurringTasksTable.id);
  res.json(ListRecurringTasksResponse.parse(rows.map(serialize)));
}));

router.post("/recurring-tasks", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateRecurringTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Frequency-specific shape checks. The spec keeps weekdays/dayOfMonth
  // optional at the type level so we enforce the cross-field rule here.
  if (data.frequency === "weekly" && (!data.weekdays || data.weekdays.length === 0)) {
    res.status(400).json({ error: "weekdays is required for weekly recurrences" });
    return;
  }
  if (data.frequency === "monthly" && (data.dayOfMonth == null)) {
    res.status(400).json({ error: "dayOfMonth is required for monthly recurrences" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const [row] = await db.insert(recurringTasksTable).values({
    userId,
    title: data.title,
    category: data.category ?? "business",
    areaId: data.areaId ?? null,
    milestoneId: data.milestoneId ?? null,
    frequency: data.frequency,
    weekdays: data.frequency === "weekly" ? stringifyWeekdays(data.weekdays ?? null) : null,
    dayOfMonth: data.frequency === "monthly" ? data.dayOfMonth ?? null : null,
    startDate: data.startDate ?? today,
  }).returning();

  res.status(201).json(serialize(row));
}));

router.patch("/recurring-tasks/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateRecurringTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRecurringTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.category !== undefined) updates.category = d.category;
  if (d.areaId !== undefined) updates.areaId = d.areaId;
  if (d.milestoneId !== undefined) updates.milestoneId = d.milestoneId;
  if (d.frequency !== undefined) updates.frequency = d.frequency;
  if (d.weekdays !== undefined) updates.weekdays = stringifyWeekdays(d.weekdays);
  if (d.dayOfMonth !== undefined) updates.dayOfMonth = d.dayOfMonth;
  if (d.startDate !== undefined) updates.startDate = d.startDate;
  if (d.pausedAt !== undefined) {
    updates.pausedAt = d.pausedAt == null ? null : new Date(d.pausedAt);
  }

  const [row] = await db
    .update(recurringTasksTable)
    .set(updates)
    .where(and(eq(recurringTasksTable.id, params.data.id), eq(recurringTasksTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Recurring task not found" });
    return;
  }

  res.json(serialize(row));
}));

router.delete("/recurring-tasks/:id", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = DeleteRecurringTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(recurringTasksTable)
    .where(and(eq(recurringTasksTable.id, params.data.id), eq(recurringTasksTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Recurring task not found" });
    return;
  }

  res.sendStatus(204);
}));

export default router;
