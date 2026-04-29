CREATE TABLE IF NOT EXISTS "daily_briefings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"date" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"briefing_json" jsonb NOT NULL,
	"source" text DEFAULT 'rules' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_briefings_user_date_uq" ON "daily_briefings" ("user_id","date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_briefings_date_idx" ON "daily_briefings" ("date");
