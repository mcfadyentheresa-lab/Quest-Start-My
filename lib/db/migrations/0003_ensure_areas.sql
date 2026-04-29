-- Idempotent bootstrap for the `areas` table.
--
-- Why this exists separately from drizzle-kit push:
-- On a deploy where the DB already had `tasks`, `milestones`, `weekly_plans`
-- etc. created by previous partial pushes but `pillars` had been dropped (or
-- never existed) and `areas` had not been created, drizzle-kit push --force
-- silently exited 0 without creating `areas` — leaving every endpoint that
-- reads from areas broken with `42P01: relation "areas" does not exist`.
--
-- This migration sidesteps that ambiguity by explicitly creating `areas` with
-- the current schema if it does not exist. It is idempotent — re-running on
-- an already-migrated DB is a no-op for every statement.

CREATE TABLE IF NOT EXISTS "areas" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'P1',
  "description" text,
  "is_active_this_week" boolean NOT NULL DEFAULT true,
  "color" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "portfolio_status" text,
  "current_stage" text,
  "why_it_matters" text,
  "now_focus" text,
  "next_focus" text,
  "later_focus" text,
  "blockers" text,
  "last_updated" text,
  "feature_tag" text,
  "category" text
);

-- The columns above represent the full current schema. If the table existed
-- already (e.g. created by an earlier successful push) but is missing any
-- of the later-added columns, ADD COLUMN IF NOT EXISTS catches that drift.
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "portfolio_status" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "current_stage" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "why_it_matters" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "now_focus" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "next_focus" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "later_focus" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "blockers" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "last_updated" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "feature_tag" text;
ALTER TABLE "areas" ADD COLUMN IF NOT EXISTS "category" text;
