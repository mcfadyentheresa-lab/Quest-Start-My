// Single source of truth for whether Clerk auth is enabled in this build.
// When the publishable key is empty/undefined we run in "owner mode" — no
// auth gate, no Clerk provider — so the app keeps working before keys are
// pasted into Railway.
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const CLERK_PUBLISHABLE_KEY: string | undefined =
  rawKey && rawKey.length > 0 ? rawKey : undefined;
export const isClerkEnabled = (): boolean => Boolean(CLERK_PUBLISHABLE_KEY);
