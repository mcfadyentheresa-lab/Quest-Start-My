import { pgTable, text, serial, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const pillarsTable = pgTable("pillars", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Phase 2 additions (all nullable, no destructive change)
  portfolioStatus: text("portfolio_status"),
  currentStage: text("current_stage"),
  whyItMatters: text("why_it_matters"),
  nowFocus: text("now_focus"),
  nextFocus: text("next_focus"),
  laterFocus: text("later_focus"),
  blockers: text("blockers"),
  lastUpdated: text("last_updated"),
  // Phase 4 additions
  featureTag: text("feature_tag"),
  // Phase 5 additions
  category: text("category"),
}, (t) => [
  unique("pillars_user_id_name_unique").on(t.userId, t.name),
]);

export const insertPillarSchema = createInsertSchema(pillarsTable).omit({ id: true, createdAt: true });
export type InsertPillar = z.infer<typeof insertPillarSchema>;
export type Pillar = typeof pillarsTable.$inferSelect;
