import { pgTable, text, serial, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type PillarPriority = "P1" | "P2" | "P3" | "P4";
export type PillarPriorityMap = Record<string, PillarPriority>;

export const weeklyPlansTable = pgTable("weekly_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  weekOf: text("week_of").notNull(),
  priorities: text("priorities").array().notNull().default([]),
  healthFocus: text("health_focus"),
  notes: text("notes"),
  activePillarIds: text("active_pillar_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Phase 2 additions (all nullable, no destructive change)
  businessFocus: text("business_focus"),
  creativeFocus: text("creative_focus"),
  whatMovedForward: text("what_moved_forward"),
  whatGotStuck: text("what_got_stuck"),
  whatContinues: text("what_continues"),
  // Phase 3 additions
  whatToDeprioritize: text("what_to_deprioritize"),
  nextWeekFocus: text("next_week_focus"),
  pillarPriorities: jsonb("pillar_priorities").$type<PillarPriorityMap>().notNull().default({}),
}, (t) => [
  unique("weekly_plans_user_id_week_of_unique").on(t.userId, t.weekOf),
]);

export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlansTable).omit({ id: true, createdAt: true });
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type WeeklyPlan = typeof weeklyPlansTable.$inferSelect;
