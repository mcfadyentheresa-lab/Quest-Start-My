-- Add `completed_at` to milestones so a goal can be marked complete
-- independently of its step state. Nullable: null means open; an ISO
-- timestamp means the goal was closed at that moment.

ALTER TABLE "milestones" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
