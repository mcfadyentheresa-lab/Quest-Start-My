import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const dailyPlansTable = pgTable("daily_plans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  priorities: text("priorities").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DailyPlan = typeof dailyPlansTable.$inferSelect;
