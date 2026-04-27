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
