-- Phase 4a: per-user timezone.
--
-- Adds users.timezone with a default of 'America/Toronto' (Theresa's tz, and
-- the safe default for everyone else until the frontend collects it).
-- Idempotent so re-running on an already-migrated DB is a no-op.

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
