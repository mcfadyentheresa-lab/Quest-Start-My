-- Phase 4: per-user timezone column.
--
-- Adds users.timezone (text, NOT NULL, default 'America/Toronto'). All
-- existing rows are backfilled with the default. The default is used by
-- the API as the fall-back when the request can't otherwise determine
-- the user's tz.
--
-- Idempotent: only adds the column if it doesn't already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "timezone" text NOT NULL DEFAULT 'America/Toronto';
  END IF;
END$$;
