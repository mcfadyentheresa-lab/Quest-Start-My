-- Phase 5: first-run onboarding state.
--
-- Adds users.onboarded_at and users.dismissed_checklist (both nullable).
-- Theresa's existing user row stays untouched; the wizard trigger also
-- checks for zero pillars, so she never sees it. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'onboarded_at'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "onboarded_at" timestamp with time zone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'dismissed_checklist'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "dismissed_checklist" timestamp with time zone;
  END IF;
END$$;
