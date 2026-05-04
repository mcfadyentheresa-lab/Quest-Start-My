-- 0007_recurring_tasks.sql
--
-- Adds the recurring_tasks template table plus a tasks.recurring_task_id
-- pointer linking a materialized task back to its template.
--
-- Idempotent so re-running on a partial DB is a no-op.

-- ── recurring_tasks table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id                       SERIAL PRIMARY KEY,
  user_id                  TEXT NOT NULL DEFAULT 'owner',
  title                    TEXT NOT NULL,
  category                 TEXT NOT NULL DEFAULT 'business',
  area_id                  INTEGER,
  milestone_id             INTEGER,
  frequency                TEXT NOT NULL,
  weekdays                 TEXT,
  day_of_month             INTEGER,
  start_date               TEXT NOT NULL,
  last_materialized_date   TEXT,
  paused_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_tasks_user_id_idx
  ON recurring_tasks(user_id);

-- area_id FK with ON DELETE SET NULL — deleting the area leaves the
-- template intact but unlinked, mirroring tasks.area_id behaviour.
DO $$
DECLARE
  has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'recurring_tasks'::regclass
      AND contype  = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%(area_id)%REFERENCES areas%'
  ) INTO has_fk;

  IF NOT has_fk THEN
    ALTER TABLE recurring_tasks
      ADD CONSTRAINT recurring_tasks_area_id_fkey
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;
  END IF;
END$$;

-- milestone_id FK with ON DELETE SET NULL — same reasoning.
DO $$
DECLARE
  has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'recurring_tasks'::regclass
      AND contype  = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%(milestone_id)%REFERENCES milestones%'
  ) INTO has_fk;

  IF NOT has_fk THEN
    ALTER TABLE recurring_tasks
      ADD CONSTRAINT recurring_tasks_milestone_id_fkey
      FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ── tasks.recurring_task_id ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'recurring_task_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN recurring_task_id INTEGER;
  END IF;
END$$;

DO $$
DECLARE
  has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'tasks'::regclass
      AND contype  = 'f'
      AND pg_get_constraintdef(oid) ILIKE '%(recurring_task_id)%REFERENCES recurring_tasks%'
  ) INTO has_fk;

  IF NOT has_fk THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_recurring_task_id_fkey
      FOREIGN KEY (recurring_task_id) REFERENCES recurring_tasks(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS tasks_recurring_task_id_idx
  ON tasks(recurring_task_id)
  WHERE recurring_task_id IS NOT NULL;
