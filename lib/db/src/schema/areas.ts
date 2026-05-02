import { pgTable, text, serial, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const areasTable = pgTable("areas", {
  id: serial("id").primaryKey(),
  // Owning user. Filled by the auth middleware on every write. Existing
  // rows are backfilled to the current single owner during the
  // 0005_user_scope migration.
  userId: text("user_id").notNull().default("owner"),
  name: text("name").notNull(),
  priority: text("priority").notNull().default("P1"),
  description: text("description"),
  isActiveThisWeek: boolean("is_active_this_week").notNull().default(true),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  portfolioStatus: text("portfolio_status"),
  nowFocus: text("now_focus"),
  lastUpdated: text("last_updated"),
  category: text("category"),
  honestNote: text("honest_note"),
}, (t) => ({
  userIdIdx: index("areas_user_id_idx").on(t.userId),
}));

export const insertAreaSchema = createInsertSchema(areasTable).omit({ id: true, createdAt: true, userId: true });
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areasTable.$inferSelect;
