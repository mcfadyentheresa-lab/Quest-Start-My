# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v4

## Applications

### Quest Start My Day (`artifacts/quest-start-my-day`)
A personal daily command center — mobile-first web app for morning planning.

**Phase 1 features:**
- Start My Day dashboard with greeting, active pillars, weekly focus, daily tasks, progress summary
- Daily task cards (business/creative/wellness) with Done/Push/Pass/Blocked actions
- Task detail: Why / Done looks like / Next step
- Progress log history view
- Dark mode toggle
- PostgreSQL persistence via shared API server

**Phase 2 features (added):**
- Weekly Control Panel: business focus, creative focus, health focus, priorities, notes — all persisted
- Weekly Reflection section (collapsible): what moved forward / what got stuck / what continues next week
- Portfolio grouping on Projects page: Active / Warm / Parked sections with P1-P4 legend
- Pillar detail view: expandable per-pillar cards showing Now / Next / Later / Blockers / Stage / Why it matters
- Re-entry panel on dashboard: "Pick up where you left off" showing last unfinished task + suggested next step
- History page: tab switcher between Activity Log and This Week summary (done/pushed/passed/blocked counts, completion rate, pillar activity)
- Task cards: subtle pillar chip shown when task is linked to an active pillar
- Add-task dialog: pillar selector (filtered to active pillars), weekly priority reminder

**Pages:**
- `/` — Start My Day dashboard
- `/weekly` — Weekly planning + reflection
- `/history` — Progress log + weekly summary tab
- `/settings` — Pillar project management (portfolio view)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `pillars` — project pillars with priority (P1-P4), portfolioStatus (Active/Warm/Parked), detail fields (currentStage, whyItMatters, nowFocus, nextFocus, laterFocus, blockers, lastUpdated)
- `tasks` — daily tasks with category (business/creative/wellness), status, rich details, pillarId FK
- `weekly_plans` — weekly priorities, healthFocus, businessFocus, creativeFocus, notes, reflection fields (whatMovedForward, whatGotStuck, whatContinues), activePillarIds
- `progress_logs` — log of task status changes for history view

## API Endpoints (key)

- `GET /api/pillars` — list all pillars
- `POST /api/pillars` — create pillar
- `PATCH /api/pillars/:id` — update pillar (incl. detail fields)
- `GET /api/tasks?date=YYYY-MM-DD` — list tasks for date
- `POST/PATCH/DELETE /api/tasks/:id` — manage tasks
- `GET /api/weekly?weekOf=YYYY-MM-DD` — get weekly plan
- `POST/PATCH /api/weekly/:id` — create/update weekly plan
- `GET /api/dashboard/summary` — today's dashboard summary
- `GET /api/dashboard/week-summary` — this week's task stats + pillar activity
- `GET /api/dashboard/reentry` — re-entry task (last unfinished or last completed)
- `GET /api/progress?limit=N` — progress log entries

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
