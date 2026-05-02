import { pgTable, text, serial, timestamp, index, unique } from "drizzle-orm/pg-core";

export const dailyPlansTable = pgTable("daily_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  date: text("date").notNull(),
  priorities: text("priorities").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDateUnique: unique("daily_plans_user_date_unique").on(t.userId, t.date),
  userIdIdx: index("daily_plans_user_id_idx").on(t.userId),
}));

export type DailyPlan = typeof dailyPlansTable.$inferSelect;
