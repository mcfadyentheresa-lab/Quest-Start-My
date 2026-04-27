# Observability — Sentry + PostHog (Phase 6)

Quest ships with optional integrations for error monitoring and product analytics. **Both are opt-in.** Leave the keys unset and the app runs identically to before — no SDK init, no network calls, no warnings.

## Sentry (errors)

Quest uses two Sentry projects: one for the React frontend, one for the Node backend.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SENTRY_DSN` | frontend bundle (Vite) | Initializes `@sentry/react` in `main.tsx`. |
| `VITE_SENTRY_ENVIRONMENT` | frontend bundle | Optional. Defaults to `import.meta.env.MODE`. |
| `SENTRY_DSN` | backend (Express) | Initializes `@sentry/node` in `app.ts`. The express error middleware (`errorHandler`) reports unhandled errors before responding. |
| `SENTRY_ENVIRONMENT` | backend | Optional. Defaults to `NODE_ENV`. |

Sample rates: `tracesSampleRate` defaults to `0.1` in production and `1.0` otherwise. Errors are always 100%.

To enable in production:

1. Create two projects in Sentry (one Browser, one Node).
2. Paste the DSNs into Railway:
   - `VITE_SENTRY_DSN=<browser_dsn>`
   - `SENTRY_DSN=<node_dsn>`
3. Redeploy.

To disable: clear the variables and redeploy.

## PostHog (product analytics)

The frontend tracks a small set of intentional events; the backend does not.

| Variable | Purpose |
| --- | --- |
| `VITE_POSTHOG_KEY` | Project API key. Leave blank to disable. |
| `VITE_POSTHOG_HOST` | Optional override of the ingestion host. Defaults to `https://us.i.posthog.com`. |

Tracked events:

| Event | When |
| --- | --- |
| `pillar_created` | A new pillar is created from `/pillars`. |
| `task_created` | A new task is created from the Add Task dialog. |
| `weekly_priorities_set` | The weekly plan form is saved. |
| `onboarding_completed` | The Welcome wizard finishes successfully. |
| `template_selected` | A starter template is picked in the Welcome wizard. |
| `checklist_dismissed` | The dashboard onboarding checklist is dismissed. |

PII handling: the event payloads contain only categorical fields (e.g. `category`, `templateId`, `count`). When Clerk is enabled, PostHog identifies the user by their Clerk user id (an opaque string). When Clerk is disabled (owner mode), no identify call is made.

To enable in production:

1. Create a PostHog project, copy the project API key.
2. Set `VITE_POSTHOG_KEY=<key>` in Railway.
3. Redeploy.

To disable: clear the variable and redeploy.
