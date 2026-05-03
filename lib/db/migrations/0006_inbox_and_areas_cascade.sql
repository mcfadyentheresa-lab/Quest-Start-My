-- 0006_inbox_and_areas_cascade.sql
--
-- Two changes, both idempotent:
--
-- 1) tasks.date becomes nullable. A NULL date means "inbox" — the task
--    was brain-dumped without a scheduled day. The inbox screen surfaces
--    these for triage. All existing date-filtered queries are unaffected
--    (NULL never matches an equality on date).
--
-- 2) milestones.area_id and tasks.area_id get an explicit ON DELETE rule
--    so deleting an area cleans up its goals (cascade) and unlinks any
--    tasks that pointed at it (set null) without orphaning them.
--
-- Wrapped per-statement so re-running is a no-op.

-- ── tasks.date nullable ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks'
      AND column_name = 'date'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN date DROP NOT NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS tasks_user_inbox_idx
  ON tasks(user_id)
  WHERE date IS NULL;

-- ── milestones.area_id ON DELETE CASCADE ────────────────────────────────
DO $$
DECLARE
  conname_var text;
BEGIN
  SELECT conname INTO conname_var
  FROM pg_constraint
  WHERE conrelid = 'milestones'::regclass
    AND contype  = 'f'
    AND pg_get_constraintdef(oid) ILIKE '%REFERENCES areas%';

  IF conname_var IS NOT NULL THEN
    EXECUTE format('ALTER TABLE milestones DROP CONSTRAINT %I', conname_var);
  END IF;

  ALTER TABLE milestones
    ADD CONSTRAINT milestones_area_id_fkey
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE;
END$$;

-- ── tasks.area_id ON DELETE SET NULL ────────────────────────────────────
-- tasks.area_id had no FK constraint at all. Add one so deleting an area
-- nulls the column on referencing tasks instead of leaving a dangling id.
DO $$
DECLARE
  has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tasks'::regclass
      AND contype  = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%(area_id)%REFERENCES areas%'
  ) INTO has_fk;

  IF NOT has_fk THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_area_id_fkey
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;
  END IF;
END$$;
