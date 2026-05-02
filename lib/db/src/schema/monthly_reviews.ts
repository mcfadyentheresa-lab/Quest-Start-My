import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { unique } from "drizzle-orm/pg-core";

export const monthlyReviewsTable = pgTable("monthly_reviews", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  monthOf: text("month_of").notNull(),
  whatMoved: text("what_moved"),
  areasAdvanced: text("areas_advanced"),
  milestonesCompleted: text("milestones_completed"),
  whatDelayed: text("what_delayed"),
  whatToPause: text("what_to_pause"),
  topPrioritiesNextMonth: text("top_priorities_next_month").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("monthly_reviews_user_month_unique").on(t.userId, t.monthOf),
  index("monthly_reviews_user_id_idx").on(t.userId),
]);

export const insertMonthlyReviewSchema = createInsertSchema(monthlyReviewsTable).omit({ id: true, createdAt: true, userId: true });
export type InsertMonthlyReview = z.infer<typeof insertMonthlyReviewSchema>;
export type MonthlyReview = typeof monthlyReviewsTable.$inferSelect;
