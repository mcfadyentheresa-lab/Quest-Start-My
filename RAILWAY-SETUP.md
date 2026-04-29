# Deploying Quest Start My Day to Railway

Follow these steps exactly. You do not need to know any code.

## What's different about this app

This repository contains **two parts in one folder**: a backend API and a frontend web page. Instead of deploying them as two separate Railway services (confusing and more expensive), this setup deploys them as **one service** where the backend also serves the frontend. You'll get a single Railway URL that does everything.

## Step 1 — Add a Postgres database

1. Open your Railway project.
2. Click **+ New** → **Database** → **Add PostgreSQL**.
3. Wait ~30 seconds until it's green.

## Step 2 — Connect this GitHub repo

If you haven't already:

1. Click **+ New** → **GitHub Repo** → pick `Quest-Start-My`.
2. Railway will start a build. **Expect the first build to fail** — we haven't set variables yet.

## Step 3 — Set environment variables

1. Click on the Quest service (not the Postgres one).
2. Go to the **Variables** tab.
3. Click **+ New Variable** and add each of these:

| Name | Value |
|---|---|
| `DATABASE_URL` | Click **Add Reference** → select Postgres → `DATABASE_URL` |
| `NODE_ENV` | `production` |
| `BASE_PATH` | `/` |
| `STATIC_DIR` | `/app/artifacts/dist` |

> ⚠️ **Do NOT** set `PORT` — Railway provides it automatically.

## Step 4 — Redeploy

1. Click **Deployments** tab → **Deploy** (or push any new commit).
2. Wait for the build (~4-6 minutes — this is a big project with two apps).
3. Open the generated URL. You should see your Quest Start My Day dashboard.

## Troubleshooting

**White page with nothing in the logs**
→ The frontend built but isn't being served. Confirm `STATIC_DIR=/app/artifacts/dist` is set (exactly that path).

**"PORT environment variable is required but was not provided"** in logs
→ This only happens locally. On Railway, `PORT` is set automatically — make sure you did NOT manually set it.

**"BASE_PATH environment variable is required but was not provided"** at build time
→ Set `BASE_PATH=/` in Railway variables.

**"DATABASE_URL must be set"** in logs
→ Set `DATABASE_URL` by referencing the Postgres plugin (see Step 3).

**Build runs out of memory**
→ This monorepo is large. In Railway → service → **Settings** → **Resources**, increase the build memory if possible. Or contact Railway support to enable a higher tier build.

**"relation does not exist" in logs at runtime**
→ The database tables weren't created or a rename migration didn't apply. Check the build logs — the step `pnpm --filter @workspace/db run deploy` should run automatically. It runs the pillars→areas rename (idempotent) and then `drizzle-kit push --force`. If it failed, the build logs will show which statement broke.

**"503 DATABASE_SCHEMA_MISMATCH" from any /api/ endpoint**
→ A required table or column is missing from the database. This usually means a migration was added to the codebase but the deployed database hasn't received it yet. Trigger a redeploy in Railway — the build phase will run pending migrations. If the issue persists, you can manually run:
```
DATABASE_URL=<railway-pg-url> node lib/db/migrate-rename.mjs up
```

## How it works, in plain terms

1. Railway runs `pnpm install` to download all the code pieces.
2. Runs `pnpm run build` — this compiles the backend and builds the frontend into plain HTML/CSS/JS files at `artifacts/dist/`.
3. Runs `pnpm --filter @workspace/db run deploy` — this applies pending rename migrations (e.g. pillars→areas) and then runs `drizzle-kit push --force` to sync the rest of the schema.
4. Starts the backend with `pnpm --filter @workspace/api-server run start`.
5. The backend sees `STATIC_DIR=/app/artifacts/dist` and serves the frontend from the same URL. When you visit `/`, you get the React app. When the React app asks for data at `/api/...`, the backend handles it.
