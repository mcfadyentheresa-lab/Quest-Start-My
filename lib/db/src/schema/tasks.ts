import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { milestonesTable } from "./milestones";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("business"),
  whyItMatters: text("why_it_matters"),
  doneLooksLike: text("done_looks_like"),
  suggestedNextStep: text("suggested_next_step"),
  status: text("status").notNull().default("pending"),
  pillarId: integer("pillar_id"),
  milestoneId: integer("milestone_id").references(() => milestonesTable.id),
  blockerReason: text("blocker_reason"),
  date: text("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
