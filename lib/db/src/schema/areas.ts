import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const areasTable = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priority: text("priority").notNull().default("P1"),
  description: text("description"),
  isActiveThisWeek: boolean("is_active_this_week").notNull().default(true),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  portfolioStatus: text("portfolio_status"),
  lastUpdated: text("last_updated"),
  category: text("category"),
  honestNote: text("honest_note"),
});

export const insertAreaSchema = createInsertSchema(areasTable).omit({ id: true, createdAt: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areasTable.$inferSelect;
