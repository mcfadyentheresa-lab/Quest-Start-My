// Sentry frontend init — opt-in via VITE_SENTRY_DSN. When unset, every
// export is a no-op so the build runs identically to before.
const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
  (import.meta.env.MODE as string | undefined) ??
  "development";

export const isSentryEnabled = (): boolean => Boolean(DSN);

export async function initSentry(): Promise<void> {
  if (!DSN) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: DSN,
      environment: ENV,
      tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
    });
  } catch {
    // Never let observability init break the app.
  }
}
