-- Phase 3: information architecture consolidation.
--
-- Destructive but safe — every drop has a corresponding backfill where the
-- old data was meaningful. Order matters:
--
--   1. Add weekly_plans.pillarPriorities (jsonb, default '{}').
--   2. Backfill weekly_plans.pillarPriorities for the CURRENT week from each
--      user's pillars.priority values BEFORE we drop pillars.priority. This
--      preserves Theresa's (and any other tenant's) per-pillar priority for
--      this week. Older weeks already happened — leaving them as `{}` is the
--      correct semantic, since priority was never a per-week concept before.
--   3. Drop pillars.priority. Per-week priority lives on weekly_plans now.
--   4. Drop pillars.isActiveThisWeek — duplicates weekly_plans.activePillarIds.
--   5. Drop daily_plans entirely (cascade). The /today flow has been replaced
--      with inline priorities on the Dashboard, sourced from
--      weekly_plans.pillarPriorities.
--
-- The migrator runs the file inside an implicit transaction, so the backfill
-- and the column drop are atomic.

-- 1. Add pillarPriorities to weekly_plans (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_plans' AND column_name = 'pillar_priorities'
  ) THEN
    ALTER TABLE "weekly_plans"
      ADD COLUMN "pillar_priorities" jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- 2. Backfill pillar_priorities for the current week, per user, from
--    pillars.priority. Only runs while pillars.priority still exists.
DO $$
DECLARE
  current_week text;
  has_priority_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pillars' AND column_name = 'priority'
  ) INTO has_priority_col;

  IF NOT has_priority_col THEN
    RETURN;
  END IF;

  -- Postgres week starting Monday, ISO. Match the app's getWeekStart() which
  -- floors to Monday in UTC.
  current_week := to_char(date_trunc('week', (now() AT TIME ZONE 'UTC')::date), 'YYYY-MM-DD');

  -- Ensure every user with at least one pillar has a weekly_plans row for the
  -- current week so we have somewhere to write the priorities.
  INSERT INTO "weekly_plans" ("user_id", "week_of", "priorities", "active_pillar_ids", "pillar_priorities")
  SELECT DISTINCT p."user_id", current_week, '{}'::text[], '{}'::text[], '{}'::jsonb
  FROM "pillars" p
  ON CONFLICT ("user_id", "week_of") DO NOTHING;

  -- Build pillar_priorities map for each user from existing pillars.priority.
  -- jsonb_object_agg over text-keyed pillar id → priority. Only include
  -- pillars whose portfolio status is Active (or unset, which legacy treats
  -- as Active) so parked/warm pillars don't pollute the per-week map.
  UPDATE "weekly_plans" wp
  SET "pillar_priorities" = COALESCE(sub.priorities_map, '{}'::jsonb)
  FROM (
    SELECT
      p."user_id",
      jsonb_object_agg(p."id"::text, p."priority") AS priorities_map
    FROM "pillars" p
    WHERE
      p."priority" IS NOT NULL
      AND (p."portfolio_status" IS NULL OR p."portfolio_status" = 'Active')
    GROUP BY p."user_id"
  ) sub
  WHERE wp."user_id" = sub."user_id"
    AND wp."week_of" = current_week;
END$$;

-- 3. Drop pillars.priority (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pillars' AND column_name = 'priority'
  ) THEN
    ALTER TABLE "pillars" DROP COLUMN "priority";
  END IF;
END$$;

-- 4. Drop pillars.isActiveThisWeek (idempotent). weekly_plans.activePillarIds
--    is the canonical source for "active this week".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pillars' AND column_name = 'is_active_this_week'
  ) THEN
    ALTER TABLE "pillars" DROP COLUMN "is_active_this_week";
  END IF;
END$$;

-- 5. Drop daily_plans entirely (idempotent, cascade for any lingering FKs).
DROP TABLE IF EXISTS "daily_plans" CASCADE;
