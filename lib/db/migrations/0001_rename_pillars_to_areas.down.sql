-- Down migration: revert rename of pillars to areas.
-- Pairs with 0001_rename_pillars_to_areas.sql.

ALTER TABLE IF EXISTS "monthly_reviews" RENAME COLUMN "areas_advanced" TO "pillars_advanced";
ALTER TABLE IF EXISTS "weekly_plans" RENAME COLUMN "area_priorities" TO "active_pillar_ids";
ALTER TABLE IF EXISTS "milestones" RENAME COLUMN "area_id" TO "pillar_id";
ALTER TABLE IF EXISTS "tasks" RENAME COLUMN "area_id" TO "pillar_id";

ALTER TABLE IF EXISTS "areas" RENAME TO "pillars";
