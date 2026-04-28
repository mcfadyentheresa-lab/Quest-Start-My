-- Migration: rename pillars to areas (Phase 8: demote pillars to areas)
--
-- Reversible: see 0001_rename_pillars_to_areas.down.sql for the inverse.
-- Preserves all data — this is a pure rename, no inserts/deletes.
--
-- Affected:
--   - table  pillars              -> areas
--   - column tasks.pillar_id      -> tasks.area_id
--   - column milestones.pillar_id -> milestones.area_id
--   - column weekly_plans.active_pillar_ids -> weekly_plans.area_priorities
--   - column monthly_reviews.pillars_advanced -> monthly_reviews.areas_advanced

ALTER TABLE IF EXISTS "pillars" RENAME TO "areas";

ALTER TABLE IF EXISTS "tasks" RENAME COLUMN "pillar_id" TO "area_id";
ALTER TABLE IF EXISTS "milestones" RENAME COLUMN "pillar_id" TO "area_id";
ALTER TABLE IF EXISTS "weekly_plans" RENAME COLUMN "active_pillar_ids" TO "area_priorities";
ALTER TABLE IF EXISTS "monthly_reviews" RENAME COLUMN "pillars_advanced" TO "areas_advanced";
