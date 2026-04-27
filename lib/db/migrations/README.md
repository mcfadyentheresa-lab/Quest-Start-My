# Database migrations

This folder holds Drizzle-generated SQL migration files. The workflow is:

1. **Edit schema** in `lib/db/src/schema/`.
2. **Generate a migration** from the diff:
   ```bash
   pnpm --filter @workspace/db run generate
   ```
   This writes a new SQL file (and updates `_journal.json`) into this folder.
3. **Review the SQL** before committing — Drizzle is generally good but
   destructive renames/drops should be sanity-checked.
4. **Apply migrations** in production:
   ```bash
   pnpm --filter @workspace/db run migrate
   ```
   This runs `migrate.mjs`, which uses
   `drizzle-orm/node-postgres/migrator` to apply any pending files in
   journal order against `DATABASE_URL`.

`drizzle-kit push` is still available for local development, but production
deploys should use `migrate` so changes are deterministic and auditable.

## Migration index

- `index_0000_phase2_auth.sql` — adds `users` table, owner user, and `user_id`
  on every tenant table; backfills + adds composite uniques scoped by user.
- `index_0001_phase3_ia.sql` — **destructive but data-preserving**. Adds
  `weekly_plans.pillar_priorities` (jsonb), backfills it for the current week
  from each user's `pillars.priority`, then drops `pillars.priority`,
  `pillars.is_active_this_week`, and the entire `daily_plans` table. The
  backfill happens in the same transaction as the drop, so per-week priorities
  are preserved before the source column disappears. Older weeks remain `{}`
  by design — priority was never a per-week concept before this phase.
