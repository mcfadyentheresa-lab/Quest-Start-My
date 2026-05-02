-- 0005_user_scope.sql
--
-- Adds per-user scoping to all owned tables. Existing rows are backfilled to
-- the current single owner (default "owner" — overridable via the
-- QUEST_OWNER_USER_ID env var on the deploy that sets up auth).
--
-- This migration is idempotent: every operation is guarded with
-- IF NOT EXISTS / DO blocks so re-running is a no-op.
--
-- Tables touched: areas, tasks, milestones, weekly_plans, monthly_reviews,
-- progress_logs, daily_plans.
--
-- The runner (migrate-rename.mjs) wraps each migration file in its own
-- transaction, so this file does NOT add an outer BEGIN/COMMIT — a nested
-- COMMIT would close the runner's transaction prematurely.

-- ── areas ────────────────────────────────────────────────────────────────
ALTER TABLE areas ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS areas_user_id_idx ON areas(user_id);

-- ── tasks ────────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_user_date_idx ON tasks(user_id, date);

-- ── milestones ───────────────────────────────────────────────────────────
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS milestones_user_id_idx ON milestones(user_id);

-- ── weekly_plans ─────────────────────────────────────────────────────────
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS weekly_plans_user_week_idx ON weekly_plans(user_id, week_of);

-- ── monthly_reviews ──────────────────────────────────────────────────────
ALTER TABLE monthly_reviews ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS monthly_reviews_user_id_idx ON monthly_reviews(user_id);

-- The old monthly_reviews_month_of_unique constraint scoped uniqueness to
-- (month_of) globally. Multi-tenant uniqueness must be (user_id, month_of).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_reviews_month_of_unique'
  ) THEN
    ALTER TABLE monthly_reviews DROP CONSTRAINT monthly_reviews_month_of_unique;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_reviews_user_month_unique'
  ) THEN
    ALTER TABLE monthly_reviews
      ADD CONSTRAINT monthly_reviews_user_month_unique UNIQUE (user_id, month_of);
  END IF;
END $$;

-- ── progress_logs ────────────────────────────────────────────────────────
ALTER TABLE progress_logs ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS progress_logs_user_id_idx ON progress_logs(user_id);
CREATE INDEX IF NOT EXISTS progress_logs_user_date_idx ON progress_logs(user_id, date);

-- ── daily_plans ──────────────────────────────────────────────────────────
ALTER TABLE daily_plans ADD COLUMN IF NOT EXISTS user_id text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS daily_plans_user_id_idx ON daily_plans(user_id);

-- The old daily_plans_date_key constraint scoped uniqueness to (date)
-- globally. Multi-tenant uniqueness must be (user_id, date).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_plans_date_key'
  ) THEN
    ALTER TABLE daily_plans DROP CONSTRAINT daily_plans_date_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_plans_user_date_unique'
  ) THEN
    ALTER TABLE daily_plans
      ADD CONSTRAINT daily_plans_user_date_unique UNIQUE (user_id, date);
  END IF;
END $$;

-- ── Backfill ─────────────────────────────────────────────────────────────
-- All existing rows belong to the single owner. Their user_id was set to
-- 'owner' by the column default; this is an explicit guard for any rows
-- that might have a NULL or empty user_id from prior partial runs.
UPDATE areas           SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE tasks           SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE milestones      SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE weekly_plans    SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE monthly_reviews SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE progress_logs   SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
UPDATE daily_plans     SET user_id = 'owner' WHERE user_id IS NULL OR user_id = '';
