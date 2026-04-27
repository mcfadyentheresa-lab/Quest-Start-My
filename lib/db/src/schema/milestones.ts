import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pillarsTable } from "./pillars";
import { usersTable } from "./users";

export const milestonesTable = pgTable("milestones", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  pillarId: integer("pillar_id").notNull().references(() => pillarsTable.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("planned"),
  priority: text("priority"),
  targetDate: text("target_date"),
  description: text("description"),
  nextAction: text("next_action"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMilestoneSchema = createInsertSchema(milestonesTable).omit({ id: true, createdAt: true });
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestonesTable.$inferSelect;
