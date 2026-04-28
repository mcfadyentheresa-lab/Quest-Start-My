import { pgTable, text, serial, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const dailyBriefingsTable = pgTable(
  "daily_briefings",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id"),
    date: text("date").notNull(),
    kind: text("kind").notNull().default("morning"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    briefingJson: jsonb("briefing_json").notNull(),
    source: text("source").notNull().default("rules"),
    reflection: text("reflection"),
  },
  (table) => ({
    userDateKindUnique: uniqueIndex("daily_briefings_user_date_kind_uq").on(
      table.userId,
      table.date,
      table.kind,
    ),
    dateIdx: index("daily_briefings_date_idx").on(table.date),
  }),
);

export type DailyBriefing = typeof dailyBriefingsTable.$inferSelect;
export type InsertDailyBriefing = typeof dailyBriefingsTable.$inferInsert;
export type DailyBriefingKind = "morning" | "evening";
