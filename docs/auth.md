# Auth & multi-tenancy

Phase 2 introduces Clerk for sign-in plus per-user data scoping. The system
has two modes, controlled entirely by environment variables.

## Owner mode (default)

When `CLERK_SECRET_KEY` is **unset**, the backend runs in *owner mode*:

- `requireAuth` skips token validation and stamps every request with
  `req.userId = process.env.OWNER_USER_ID || "owner"`.
- The frontend (`VITE_CLERK_PUBLISHABLE_KEY` unset) renders without a Clerk
  provider — no sign-in UI, no auth gate. The API client sends no auth
  header.
- All existing rows are owned by the `'owner'` user (created and backfilled
  by the Phase 2 migration).

This is the state the app ships in until keys are pasted into Railway. From
the user's perspective, everything works exactly as before.

The server logs a single `Auth: owner mode` warning at boot so it is obvious
which mode is active.

## Clerk mode

Set both keys to switch modes:

| Env var                       | Where to set | What it is                              |
|-------------------------------|--------------|------------------------------------------|
| `CLERK_SECRET_KEY`            | Railway → API | Backend token verifier (secret)          |
| `VITE_CLERK_PUBLISHABLE_KEY`  | Railway → web build | Frontend publishable key (safe to ship)  |

In Clerk mode:

- `requireAuth` calls `verifyToken` from `@clerk/express` with the request's
  `Authorization: Bearer <jwt>` header. On success it attaches
  `req.userId`/`req.userEmail`. On failure it throws `ApiError.unauthorized()`.
- A user row is auto-provisioned on first request via
  `INSERT … ON CONFLICT DO NOTHING`.
- The React app wraps everything in `<ClerkProvider>` and hides the rest of
  the app behind `<SignedIn>` / `<SignedOut>` (which redirects to `/sign-in`).
- The API client attaches `Authorization: Bearer ${await getToken()}`
  automatically (see `lib/api-client-react/src/custom-fetch.ts`).
- `/sign-in` and `/sign-up` use Clerk's prebuilt components.
- `/api/healthz` stays public.

## Switching from owner mode to Clerk mode

This is a four-step operation that takes < 2 minutes:

1. Create a Clerk application at <https://clerk.com> and copy the two keys
   from **API Keys**.
2. Set `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` in Railway.
3. Sign up once with Theresa's email (`info@asterandspruceliving.ca`) so
   Clerk creates a user row. Note the resulting Clerk user ID
   (e.g. `user_2abc…`).
4. Remap all existing data from the `'owner'` placeholder to the real Clerk
   user with a single SQL statement:

   ```sql
   UPDATE users SET id = 'user_2abc...' WHERE id = 'owner';
   ```

   The phase-2 migration set `ON UPDATE CASCADE` on every `user_id` foreign
   key, so this single update propagates to all 7 tenant tables in one
   atomic operation. No data is moved or rewritten.

That is it — Theresa will then be signed in as the same user that owns all
of her existing pillars, tasks, milestones, etc.

## Tables touched

The migration adds:

- A new `users` table (id, email, name, plan, stripe_customer_id, timestamps).
- A NOT NULL `user_id` column on every existing table:
  `pillars`, `tasks`, `milestones`, `weekly_plans`, `monthly_reviews`,
  `progress_logs`, `daily_plans`.
- Composite unique constraints scoped to `(user_id, …)` where the previous
  unique was global (e.g. `monthly_reviews.month_of`, `daily_plans.date`,
  `pillars.name`).

All existing rows are backfilled to the owner user before `NOT NULL` is
enforced, so there is no destructive change.

## How routes scope queries

Every route uses the `scoped(userId)` helper from
`artifacts/api-server/src/lib/scoped.ts`:

```ts
const s = scoped(req.userId!);
const pillars = await db.select().from(pillarsTable).where(s.pillars.owns);
const [created] = await db.insert(pillarsTable)
  .values(s.pillars.withUser({ name: "X" }))
  .returning();
```

`owns` returns a Drizzle predicate (`eq(pillarsTable.userId, userId)`) you
can compose with `and(...)`. `withUser` stamps `userId` onto an insert
payload. No route should ever query a tenant table without one of these.
