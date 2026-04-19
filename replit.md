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

**Phase 3 features (added):**
- Milestones: per-pillar milestone tracking (planned/active/blocked/complete) with title, priority, target date, description, next action — full CRUD in expanded pillar card
- Re-entry panel enriched: shows milestoneTitle, whyItMatters, blockerReason, and rules-based guidance text
- Task blocked flow: clicking "Blocked" prompts for a blocker reason before marking (captured in blockerReason field)
- Add-task dialog: milestone selector shown when a pillar is selected and it has open milestones
- Pillar Health tab (3rd tab on History): per-pillar activity summary (done count, pushed/passed, days-since-last-move), nudges for stalled pillars, warnings for Warm/Parked absorbing too much effort
- Weekly reflection: two new fields — "What to deprioritize" and "Next week's key focus"
- Weekly plan save/restore: new fields persisted to weekly_plans table (whatToDeprioritize, nextWeekFocus)

**Phase 4-A features (data layer + API — added):**
- `monthly_reviews` table: UNIQUE constraint on `month_of`, array field for `top_priorities_next_month`
- `pillars.feature_tag` column: nullable productization label
- `GET /monthly` — list reviews newest-first
- `POST /monthly` — create with 409 on duplicate `monthOf`
- `PATCH /monthly/:id` — partial update
- `GET /dashboard/outcome-metrics` — milestone completion counts, per-pillar completion rates, P1 vs warm/parked done counts
- `GET /dashboard/friction` — four signal types: `repeated_pass`, `repeated_block`, `stalled_milestone`, `low_completion_ratio`
- `GET /dashboard/pillar-health` — response restructured to `{ pillars, portfolioBalance }` with `portfolioSharePercent` per entry and aggregate `{ activeShare, warmShare, parkedShare, otherShare }` balance
- History.tsx: minimal compatibility patch to handle new pillar-health response shape (Phase 4-B will add full UI)

**Phase 4-B features (operating rhythm UI — added):**
- Monthly Review page (`/review`): 12-month picker, 6 reflection fields, 3 top-priority inputs, POST+invalidate on first save then PATCH thereafter, "Saved" badge when record exists
- History rewritten with 5 tabs: Activity, This week, Pillar health, Outcomes (outcome metrics + portfolio balance), Friction (friction signal cards)
- Settings: featureTag (personal/shared/sellable) wired into pillar create AND update; badge shown on PillarCard; milestone rows now show "Overdue" and "Xd no movement" (using `updatedAt` column); "X / Y complete" milestone summary row; drag-to-reorder milestones
- Month nav tab (BookOpen icon) added between History and Pillars in bottom nav
- Milestone `updatedAt` column added to DB; set on every PATCH; included in API responses

**Pages:**
- `/` — Start My Day dashboard
- `/weekly` — Weekly planning + reflection
- `/history` — Progress log (5 tabs: Activity, This week, Pillar health, Outcomes, Friction)
- `/review` — Monthly Review (reflections + top priorities)
- `/settings` — Pillar project management (portfolio view)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `pillars` — project pillars with priority (P1-P4), portfolioStatus (Active/Warm/Parked), detail fields (currentStage, whyItMatters, nowFocus, nextFocus, laterFocus, blockers, lastUpdated)
- `tasks` — daily tasks with category (business/creative/wellness), status, rich details, pillarId FK, milestoneId FK (nullable), blockerReason (nullable)
- `weekly_plans` — weekly priorities, healthFocus, businessFocus, creativeFocus, notes, reflection fields (whatMovedForward, whatGotStuck, whatContinues, whatToDeprioritize, nextWeekFocus), activePillarIds
- `milestones` — per-pillar milestones with status (planned/active/blocked/complete), priority (P1-P4), targetDate, description, nextAction, sortOrder
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
- `GET /api/dashboard/reentry` — re-entry task with milestoneTitle, blockerReason, whyItMatters, guidance
- `GET /api/dashboard/pillar-health` — per-pillar health: done count, days since last move, nudges, warnings
- `GET /api/milestones?pillarId=X` — milestones for a pillar
- `POST /api/milestones` — create milestone
- `PATCH /api/milestones/:id` — update milestone
- `DELETE /api/milestones/:id` — delete milestone
- `GET /api/progress?limit=N` — progress log entries

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
