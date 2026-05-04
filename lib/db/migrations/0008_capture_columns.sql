-- 0008_capture_columns.sql
--
-- Adds two columns to the tasks table to support the universal capture
-- flow:
--
--   original_dump  TEXT NULLABLE
--     The verbatim text the user pasted into Capture, preserved when AI
--     extracts a clean title. NULL when capture was short enough not to
--     need cleaning (and for tasks created via legacy paths).
--
--   needs_review   BOOLEAN NOT NULL DEFAULT FALSE
--     True when AI cleaned a brain dump into a task — the title is
--     AI-generated and the user should glance at it. UI surfaces a
--     "Review draft" chip when this is true. Set false again once the
--     user edits the title or explicitly dismisses the review.
--
-- Idempotent: safe to re-run.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS original_dump TEXT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
