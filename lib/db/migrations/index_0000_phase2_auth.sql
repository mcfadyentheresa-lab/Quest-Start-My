-- Phase 2: auth + multi-tenancy
-- Idempotent migration that:
--   1. Creates the `users` table.
--   2. Inserts the owner user (id from $OWNER_USER_ID, default 'owner').
--   3. Adds `user_id` to every existing tenant table as nullable.
--   4. Backfills every existing row to the owner user.
--   5. Sets `user_id` NOT NULL and adds the foreign key.
--   6. Adds composite unique constraints scoped to user_id.
--
-- Notes:
--   * Drizzle migrator runs the file with a single connection inside an
--     implicit transaction, so the backfill + NOT NULL transition is atomic.
--   * The owner user's id can be remapped to a real Clerk id later via:
--       UPDATE users SET id = '<clerk_id>' WHERE id = 'owner';
--     ON UPDATE CASCADE on the FKs propagates the change to every tenant row.

-- 1. users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "stripe_customer_id" text,
  "plan" text DEFAULT 'free' NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- 2. Owner user (idempotent)
INSERT INTO "users" ("id", "email", "name")
VALUES (
  COALESCE(NULLIF(current_setting('app.owner_user_id', TRUE), ''), 'owner'),
  COALESCE(NULLIF(current_setting('app.owner_email', TRUE), ''), 'info@asterandspruceliving.ca'),
  'Theresa McFadyen'
)
ON CONFLICT ("id") DO NOTHING;

-- Helper: capture the owner id once for the backfill
DO $$
DECLARE
  owner_id text := COALESCE(NULLIF(current_setting('app.owner_user_id', TRUE), ''), 'owner');
BEGIN
  -- 3 + 4: pillars
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pillars' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "pillars" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "pillars" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "pillars" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "pillars" ADD CONSTRAINT "pillars_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- tasks
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "tasks" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "tasks" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "tasks" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- milestones
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "milestones" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "milestones" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "milestones" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- weekly_plans
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_plans' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "weekly_plans" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "weekly_plans" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "weekly_plans" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- monthly_reviews
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monthly_reviews' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "monthly_reviews" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "monthly_reviews" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "monthly_reviews" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- progress_logs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progress_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "progress_logs" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "progress_logs" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "progress_logs" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "progress_logs" ADD CONSTRAINT "progress_logs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- daily_plans
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'daily_plans' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE "daily_plans" ADD COLUMN "user_id" text;
    EXECUTE format('UPDATE "daily_plans" SET "user_id" = %L WHERE "user_id" IS NULL', owner_id);
    ALTER TABLE "daily_plans" ALTER COLUMN "user_id" SET NOT NULL;
    ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 5. Composite uniques scoped to user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pillars_user_id_name_unique'
  ) THEN
    ALTER TABLE "pillars" ADD CONSTRAINT "pillars_user_id_name_unique" UNIQUE ("user_id", "name");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_plans_user_id_week_of_unique'
  ) THEN
    ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_user_id_week_of_unique" UNIQUE ("user_id", "week_of");
  END IF;

  -- monthly_reviews previously had a global unique on month_of; replace with composite.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_reviews_month_of_unique'
  ) THEN
    ALTER TABLE "monthly_reviews" DROP CONSTRAINT "monthly_reviews_month_of_unique";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_reviews_user_id_month_of_unique'
  ) THEN
    ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_user_id_month_of_unique" UNIQUE ("user_id", "month_of");
  END IF;

  -- daily_plans previously had a global unique on date; replace with composite.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_date_key'
  ) THEN
    ALTER TABLE "daily_plans" DROP CONSTRAINT "daily_plans_date_key";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_date_unique'
  ) THEN
    ALTER TABLE "daily_plans" DROP CONSTRAINT "daily_plans_date_unique";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_user_id_date_unique'
  ) THEN
    ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_date_unique" UNIQUE ("user_id", "date");
  END IF;
END$$;
