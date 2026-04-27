// Stripe SDK init — opt-in via STRIPE_SECRET_KEY env. When unset, every
// export is a safe no-op so the server runs identically to before. This
// matches the Phase 2 Clerk fallback and Phase 6 Sentry/PostHog patterns.
import type Stripe from "stripe";
import { logger } from "./logger";

const SECRET = process.env["STRIPE_SECRET_KEY"];

let cached: Stripe | null = null;
let initAttempted = false;

export function isStripeEnabled(): boolean {
  return Boolean(SECRET);
}

export function getStripe(): Stripe | null {
  if (!SECRET) return null;
  if (cached) return cached;
  if (initAttempted) return cached;
  initAttempted = true;
  try {
    // Dynamic require so the SDK is only loaded when Stripe mode is active.
    const StripeCtor = require("stripe") as typeof import("stripe").default;
    cached = new StripeCtor(SECRET, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
    logger.info("Stripe: initialized");
    return cached;
  } catch (err) {
    logger.warn({ err }, "Stripe: failed to initialize");
    return null;
  }
}

export const PRICE_MONTHLY = process.env["STRIPE_PRICE_PRO_MONTHLY"] ?? "";
export const PRICE_YEARLY = process.env["STRIPE_PRICE_PRO_YEARLY"] ?? "";
export const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
export const PORTAL_RETURN_URL =
  process.env["BILLING_PORTAL_RETURN_URL"] ?? "/profile";
