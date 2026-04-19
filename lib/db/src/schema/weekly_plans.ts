import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyPlansTable = pgTable("weekly_plans", {
  id: serial("id").primaryKey(),
  weekOf: text("week_of").notNull(),
  priorities: text("priorities").array().notNull().default([]),
  healthFocus: text("health_focus"),
  notes: text("notes"),
  activePillarIds: text("active_pillar_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlansTable).omit({ id: true, createdAt: true });
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type WeeklyPlan = typeof weeklyPlansTable.$inferSelect;
