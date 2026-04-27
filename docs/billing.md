# Stripe Billing — setup & operations

Phase 7 introduces Stripe-backed subscription billing with two plans:

| Plan | Price | Pillars | Active tasks | CSV export |
|------|-------|---------|--------------|------------|
| Free | $0 | up to 3 | up to 10 | — |
| Pro  | $9 / month or $84 / year | unlimited | unlimited | ✓ |

The whole feature is **opt-in**. With no Stripe env vars set, the app behaves
exactly as it did before Phase 7: no `/billing` route, no plan gating, no
checkout buttons. This matches the Phase 2 Clerk fallback and the Phase 6
Sentry / PostHog patterns.

## When billing is disabled

Two independent bypasses keep the app fully usable for the owner / dev mode:

1. **Owner mode** — `CLERK_SECRET_KEY` unset. The app runs as a single-user
   instance (Theresa). Plan limits are never enforced; `/billing` is hidden.
2. **Stripe not configured** — `STRIPE_SECRET_KEY` unset. Even with Clerk
   on (multi-tenant), users are treated as Pro until billing is wired up.
   The `/billing` page only renders when `VITE_STRIPE_PUBLISHABLE_KEY` is also
   set.

Either bypass alone is sufficient: anyone in either of those environments
will never see a `PLAN_LIMIT` error.

## Stripe dashboard setup

Run these in **test mode** first.

1. Create a **Product** named "Quest Pro".
2. Add two **Prices** to that product:
   - **Monthly** — $9.00 USD recurring monthly.
   - **Yearly** — $84.00 USD recurring yearly.
   Note the two `price_…` IDs.
3. Create a **Webhook endpoint** pointed at
   `https://<your-host>/api/billing/webhook`. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   Copy the signing secret (`whsec_…`).
4. (Optional) Configure the **Customer Portal** branding under
   *Settings → Billing → Customer portal*.

## Environment variables

| Variable | Side | Required when | Purpose |
|----------|------|---------------|---------|
| `STRIPE_SECRET_KEY` | server | enabling billing | server-side Stripe client |
| `STRIPE_WEBHOOK_SECRET` | server | enabling billing | webhook signature verification |
| `STRIPE_PRICE_PRO_MONTHLY` | server | enabling billing | monthly price ID |
| `STRIPE_PRICE_PRO_YEARLY` | server | enabling billing | yearly price ID |
| `VITE_STRIPE_PUBLISHABLE_KEY` | bundle | enabling billing UI | shows the `/billing` page in the React app |
| `BILLING_PORTAL_RETURN_URL` | server | optional | URL Stripe Portal redirects to (default `/profile`) |

Set them in Railway's *Variables* tab (or your `.env.local` for local dev).

## Routes

- `GET  /api/billing/status` — public; reports whether billing is enabled.
- `GET  /api/billing/usage` — authed; returns the user's plan + counts.
- `POST /api/billing/checkout` — authed; body `{ priceId: 'monthly' | 'yearly' }`,
  returns `{ url }` to redirect to Stripe Checkout.
- `POST /api/billing/portal` — authed; returns `{ url }` to the Stripe
  Customer Portal.
- `POST /api/billing/webhook` — public; verifies signature and updates
  `users.plan`, `users.stripeSubscriptionId`, `users.subscriptionStatus`,
  `users.currentPeriodEnd`.

## How plan changes propagate

1. User clicks **Upgrade** on `/billing` → `POST /api/billing/checkout` →
   redirects to Stripe Checkout.
2. On success, Stripe redirects to `/billing?status=success`.
3. Stripe asynchronously POSTs `checkout.session.completed` to
   `/api/billing/webhook`. The handler sets `users.plan = 'pro'` and stores
   the subscription metadata.
4. Subsequent renewals / cancellations arrive as
   `customer.subscription.updated` and `customer.subscription.deleted`,
   which downgrade the user back to `'free'` when the status becomes
   `canceled` / `unpaid` / `incomplete_expired`.

Free users hitting a limit see a `PLAN_LIMIT` error envelope; the React app
turns it into a toast that points at `/billing`.
