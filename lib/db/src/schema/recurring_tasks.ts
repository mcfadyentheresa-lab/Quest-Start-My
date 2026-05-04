import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { areasTable } from "./areas";
import { milestonesTable } from "./milestones";

// Templates for tasks that should auto-appear on the user's plan on a
// recurring cadence (e.g. social media posts, monthly bill payments).
//
// PR 1 supports three frequencies:
//   - "daily"   — every day from startDate forward
//   - "weekly"  — on the weekdays listed in `weekdays` (0=Sun..6=Sat)
//   - "monthly" — on `dayOfMonth` (1..31; clamped to last day for short months)
//
// The actual to-do items live in `tasks` and are linked back here via
// `tasks.recurring_task_id`. Materialization (the act of inserting a real
// task row for a given day) happens lazily in the API server when the
// daily plan is fetched. `lastMaterializedDate` is the high-water mark
// so we never insert duplicates.
//
// `pausedAt` is a soft-pause: when set, no new instances are materialized,
// but the template and its history are preserved.
export const recurringTasksTable = pgTable("recurring_tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  title: text("title").notNull(),
  category: text("category").notNull().default("business"),
  // Optional links so the materialized task inherits area/goal context.
  areaId: integer("area_id").references(() => areasTable.id, { onDelete: "set null" }),
  milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
  // "daily" | "weekly" | "monthly". Stored as text for forward-compat.
  frequency: text("frequency").notNull(),
  // For frequency = "weekly": JSON-encoded int array of weekdays (0=Sun..6=Sat).
  // Stored as text for portability across pg drivers.
  weekdays: text("weekdays"),
  // For frequency = "monthly": day of month (1..31). Clamped at materialization
  // time to the last day of months that don't have it (e.g. 31 → 28/29/30).
  dayOfMonth: integer("day_of_month"),
  // YYYY-MM-DD. The cadence does not produce instances before this date.
  startDate: text("start_date").notNull(),
  // YYYY-MM-DD. Latest date for which an instance has been considered. Null
  // means nothing has been materialized yet.
  lastMaterializedDate: text("last_materialized_date"),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("recurring_tasks_user_id_idx").on(t.userId),
}));

export const insertRecurringTaskSchema = createInsertSchema(recurringTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});
export type InsertRecurringTask = z.infer<typeof insertRecurringTaskSchema>;
export type RecurringTask = typeof recurringTasksTable.$inferSelect;
