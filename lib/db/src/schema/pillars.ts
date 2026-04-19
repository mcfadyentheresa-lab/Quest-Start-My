import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pillarsTable = pgTable("pillars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  priority: text("priority").notNull().default("P1"),
  description: text("description"),
  isActiveThisWeek: boolean("is_active_this_week").notNull().default(true),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPillarSchema = createInsertSchema(pillarsTable).omit({ id: true, createdAt: true });
export type InsertPillar = z.infer<typeof insertPillarSchema>;
export type Pillar = typeof pillarsTable.$inferSelect;
