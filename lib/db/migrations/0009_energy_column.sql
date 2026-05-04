-- 0009_energy_column.sql
--
-- Adds an optional energy tag to tasks so the user can flag work as
-- quick / medium / deep. NULL means unset (the user hasn't decided
-- yet). The column powers the "Feeling scattered? See 3 quick wins."
-- pill on Today and the energy filter chip on Capture.
--
-- Stored as TEXT (not an enum) so we can rename or extend the bands
-- later without an ALTER TYPE migration. Validation lives in the
-- application layer (zod) where it's easier to evolve.
--
-- Idempotent: safe to re-run.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS energy TEXT;
