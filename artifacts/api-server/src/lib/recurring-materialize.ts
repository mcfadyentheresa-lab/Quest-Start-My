// Materialization helper for recurring task templates.
//
// Called lazily from the daily-tasks endpoint. Two responsibilities:
//
//  1. Roll forward — any pending task that was materialized from a recurring
//     template on an earlier date is bumped to `today`. Bills and habits
//     don't disappear because the user missed a day; they keep showing up
//     until they're done or skipped.
//
//  2. Materialize — for each non-paused template that is "due" today
//     (per its frequency rule) AND doesn't already have a pending instance
//     for today (after roll-forward), insert a new task row.
//
// `lastMaterializedDate` is the high-water mark on the template; we
// advance it to today after a successful run so subsequent calls in the
// same day are no-ops.
//
// All operations are scoped to the supplied userId.

import { and, eq, lt, or, isNotNull, isNull, inArray } from "drizzle-orm";
import { db, recurringTasksTable, tasksTable } from "@workspace/db";
import { isDueOn } from "./recurring-due";

export { isDueOn } from "./recurring-due";

// Public entry point. Idempotent: safe to call repeatedly for the same
// (userId, today) pair.
export async function materializeRecurringTasks(userId: string, todayIso: string): Promise<void> {
  // Step 1: roll forward stale pending instances.
  //
  // A "stale" instance is a task whose status is still pending, that was
  // created from a recurring template, and whose scheduled date is before
  // today. Pull them today so the user sees them on the daily plan instead
  // of having to hunt through history.
  await db
    .update(tasksTable)
    .set({ date: todayIso })
    .where(and(
      eq(tasksTable.userId, userId),
      eq(tasksTable.status, "pending"),
      isNotNull(tasksTable.recurringTaskId),
      lt(tasksTable.date, todayIso),
    ));

  // Step 2: figure out which templates need a fresh instance for today.
  const templates = await db
    .select()
    .from(recurringTasksTable)
    .where(and(
      eq(recurringTasksTable.userId, userId),
      isNull(recurringTasksTable.pausedAt),
    ));

  const dueTemplates = templates.filter((t) => isDueOn(t, todayIso));
  if (dueTemplates.length === 0) return;

  const dueTemplateIds = dueTemplates.map((t) => t.id);

  // Find which due templates already have ANY task linked back to them on
  // today's date (covers both freshly-rolled-forward instances and any
  // already-materialized today). One row per template per day is the rule.
  const existingToday = await db
    .select({
      recurringTaskId: tasksTable.recurringTaskId,
    })
    .from(tasksTable)
    .where(and(
      eq(tasksTable.userId, userId),
      eq(tasksTable.date, todayIso),
      inArray(tasksTable.recurringTaskId, dueTemplateIds),
    ));

  const coveredIds = new Set(
    existingToday.flatMap((r) => (r.recurringTaskId != null ? [r.recurringTaskId] : [])),
  );

  const toInsert = dueTemplates.filter((t) => !coveredIds.has(t.id));

  if (toInsert.length > 0) {
    await db.insert(tasksTable).values(toInsert.map((t) => ({
      userId,
      title: t.title,
      category: t.category,
      areaId: t.areaId ?? null,
      milestoneId: t.milestoneId ?? null,
      date: todayIso,
      status: "pending",
      recurringTaskId: t.id,
    })));
  }

  // Step 3: bump lastMaterializedDate on every due template (whether or
  // not we actually inserted) so we don't keep re-checking. We deliberately
  // do NOT use `ne(col, todayIso)` to skip already-bumped rows, because
  // when the column is NULL `ne` evaluates to UNKNOWN in SQL and the row
  // is filtered out. Two acceptable approaches: write the same value back
  // (a no-op cost) or guard with `OR IS NULL`. We use the explicit guard
  // so we don't pay an UPDATE cost on rows that are already at today.
  await db
    .update(recurringTasksTable)
    .set({ lastMaterializedDate: todayIso, updatedAt: new Date() })
    .where(and(
      eq(recurringTasksTable.userId, userId),
      inArray(recurringTasksTable.id, dueTemplateIds),
      or(
        isNull(recurringTasksTable.lastMaterializedDate),
        lt(recurringTasksTable.lastMaterializedDate, todayIso),
      ),
    ));
}
