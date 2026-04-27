import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const progressLogsTable = pgTable("progress_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  taskId: integer("task_id"),
  taskTitle: text("task_title").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProgressLogSchema = createInsertSchema(progressLogsTable).omit({ id: true, loggedAt: true });
export type InsertProgressLog = z.infer<typeof insertProgressLogSchema>;
export type ProgressLog = typeof progressLogsTable.$inferSelect;
