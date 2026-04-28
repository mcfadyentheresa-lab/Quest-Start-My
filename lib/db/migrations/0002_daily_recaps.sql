-- Add evening recap support to daily_briefings.
-- Adds `kind` discriminator (morning | evening) and a `reflection` text column.
-- The original unique index (user_id, date) is replaced by (user_id, date, kind)
-- so morning + evening rows can coexist for the same user/date.

ALTER TABLE "daily_briefings" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'morning';
--> statement-breakpoint
ALTER TABLE "daily_briefings" ADD COLUMN IF NOT EXISTS "reflection" text;
--> statement-breakpoint
DROP INDEX IF EXISTS "daily_briefings_user_date_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_briefings_user_date_kind_uq" ON "daily_briefings" ("user_id","date","kind");
