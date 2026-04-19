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

**Features:**
- Start My Day dashboard with greeting, active pillars, weekly focus, daily tasks, progress summary
- Daily task cards (business/creative/wellness) with Done/Push/Pass/Blocked actions
- Weekly planning with priorities, health focus, pillar active/inactive toggles
- Progress log history view
- Pillar project management (4 pillars: Aster & Spruce Connect P1, Quest Workday P1, Circadian App P2, AI Assistant Helper P3)
- Dark mode toggle
- PostgreSQL persistence via shared API server

**Pages:**
- `/` — Start My Day dashboard
- `/weekly` — Weekly planning
- `/history` — Progress log
- `/settings` — Pillar project management

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `pillars` — project pillar projects with priority (P1-P4), color, active status
- `tasks` — daily tasks with category (business/creative/wellness), status, rich details
- `weekly_plans` — weekly priorities, health focus, active pillar IDs
- `progress_logs` — log of task status changes for history view

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
