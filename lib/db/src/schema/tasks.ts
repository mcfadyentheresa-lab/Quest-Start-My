import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { milestonesTable } from "./milestones";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  title: text("title").notNull(),
  category: text("category").notNull().default("business"),
  whyItMatters: text("why_it_matters"),
  doneLooksLike: text("done_looks_like"),
  suggestedNextStep: text("suggested_next_step"),
  status: text("status").notNull().default("pending"),
  // FK to areas with ON DELETE SET NULL (added in migration 0006). Tasks
  // survive when their area is deleted; they just become loose tasks.
  areaId: integer("area_id"),
  milestoneId: integer("milestone_id").references(() => milestonesTable.id, { onDelete: "set null" }),
  blockerReason: text("blocker_reason"),
  // Nullable: NULL = inbox (brain-dumped, not yet scheduled).
  date: text("date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  parentTaskId: integer("parent_task_id"),
  stepBackDepth: integer("step_back_depth").notNull().default(0),
  blockerType: text("blocker_type"),
  adjustmentType: text("adjustment_type"),
  adjustmentReason: text("adjustment_reason"),
  taskSource: text("task_source"),
  // Phase 3: position within the parent milestone ("goal"). Used to surface
  // step-by-step goals one step at a time — lowest pending sortOrder
  // wins. For loose tasks (no milestoneId) this is unused; default 0.
  sortOrder: integer("sort_order").notNull().default(0),
  // Set when this task was materialized from a recurring template (see
  // recurring_tasks). Nullable: ad-hoc tasks have no template. ON DELETE
  // SET NULL is configured in the migration so deleting a template leaves
  // already-materialized history intact.
  recurringTaskId: integer("recurring_task_id"),
}, (t) => ({
  userIdIdx: index("tasks_user_id_idx").on(t.userId),
  userDateIdx: index("tasks_user_date_idx").on(t.userId, t.date),
}));

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, userId: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
