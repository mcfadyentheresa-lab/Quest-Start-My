import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { areasTable } from "./areas";

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  areaId: integer("area_id").notNull().references(() => areasTable.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("planned"),
  priority: text("priority"),
  targetDate: text("target_date"),
  description: text("description"),
  nextAction: text("next_action"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Phase 3: how the goal hands out its sub-tasks.
  //   "ordered" — only the lowest-sortOrder pending sub-task is eligible
  //              for the daily briefing. Later steps stay locked until
  //              earlier ones close. Default for new goals.
  //   "any"     — any open sub-task can be picked. Useful when steps
  //              don't depend on each other.
  // Stored as text so we can add modes later without a migration.
  mode: text("mode").notNull().default("ordered"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({ id: true, createdAt: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;
