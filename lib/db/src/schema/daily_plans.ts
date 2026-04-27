import { pgTable, text, serial, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const dailyPlansTable = pgTable("daily_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  priorities: text("priorities").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("daily_plans_user_id_date_unique").on(t.userId, t.date),
]);

export type DailyPlan = typeof dailyPlansTable.$inferSelect;
