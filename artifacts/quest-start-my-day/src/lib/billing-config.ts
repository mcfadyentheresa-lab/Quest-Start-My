// Single source of truth for whether Stripe billing is enabled in this build.
// When the publishable key is empty/undefined the billing UI is hidden and
// the app behaves identically to before — same opt-in pattern as
// VITE_CLERK_PUBLISHABLE_KEY (Phase 2) and VITE_SENTRY_DSN (Phase 6).
const rawKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const STRIPE_PUBLISHABLE_KEY: string | undefined =
  rawKey && rawKey.length > 0 ? rawKey : undefined;
export const isBillingEnabled = (): boolean => Boolean(STRIPE_PUBLISHABLE_KEY);
