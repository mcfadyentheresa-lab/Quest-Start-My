// Sentry backend init — opt-in via SENTRY_DSN env. When unset, every export
// is a safe no-op so the server runs identically to before.
import { logger } from "./logger";

const DSN = process.env["SENTRY_DSN"];
const ENV = process.env["SENTRY_ENVIRONMENT"] ?? process.env["NODE_ENV"] ?? "development";

let initialized = false;
let sentry: typeof import("@sentry/node") | null = null;

export function isSentryEnabled(): boolean {
  return Boolean(DSN);
}

export async function initSentry(): Promise<void> {
  if (initialized || !DSN) return;
  initialized = true;
  try {
    const mod = await import("@sentry/node");
    mod.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
    });
    sentry = mod;
    logger.info({ environment: ENV }, "Sentry: initialized");
  } catch (err) {
    logger.warn({ err }, "Sentry: failed to initialize, continuing without it");
  }
}

export function captureError(err: unknown): void {
  if (!sentry) return;
  try {
    sentry.captureException(err);
  } catch {
    // swallow — never let Sentry break the request path
  }
}
