import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const progressLogsTable = pgTable("progress_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("owner"),
  taskId: integer("task_id"),
  taskTitle: text("task_title").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("progress_logs_user_id_idx").on(t.userId),
  userDateIdx: index("progress_logs_user_date_idx").on(t.userId, t.date),
}));

export const insertProgressLogSchema = createInsertSchema(progressLogsTable).omit({ id: true, loggedAt: true, userId: true });
export type InsertProgressLog = z.infer<typeof insertProgressLogSchema>;
export type ProgressLog = typeof progressLogsTable.$inferSelect;
