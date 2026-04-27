-- Phase 7: Stripe subscription billing.
--
-- Adds users.stripe_subscription_id, users.subscription_status, and
-- users.current_period_end. All nullable. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "stripe_subscription_id" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "subscription_status" text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'current_period_end'
  ) THEN
    ALTER TABLE "users"
      ADD COLUMN "current_period_end" timestamp with time zone;
  END IF;
END$$;
