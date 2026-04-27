// PostHog frontend analytics — opt-in via VITE_POSTHOG_KEY. When unset,
// every export is a no-op. Never sends raw PII; identifies via the Clerk
// user id (already a stable opaque string).
type PostHogModule = typeof import("posthog-js").default;

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  "https://us.i.posthog.com";

let posthogInstance: PostHogModule | null = null;
let initPromise: Promise<void> | null = null;

export const isAnalyticsEnabled = (): boolean => Boolean(KEY);

export function initAnalytics(): Promise<void> {
  if (!KEY) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mod = await import("posthog-js");
      const ph = mod.default;
      ph.init(KEY, {
        api_host: HOST,
        capture_pageview: true,
        autocapture: false,
        persistence: "localStorage",
      });
      posthogInstance = ph;
    } catch {
      // Never let analytics init break the app.
    }
  })();
  return initPromise;
}

export type AnalyticsEvent =
  | "pillar_created"
  | "task_created"
  | "weekly_priorities_set"
  | "onboarding_completed"
  | "template_selected"
  | "checklist_dismissed";

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (!posthogInstance) return;
  try {
    posthogInstance.capture(event, properties);
  } catch {
    // swallow
  }
}

export function identifyUser(userId: string | null | undefined): void {
  if (!posthogInstance || !userId) return;
  try {
    posthogInstance.identify(userId);
  } catch {
    // swallow
  }
}

export function resetIdentity(): void {
  if (!posthogInstance) return;
  try {
    posthogInstance.reset();
  } catch {
    // swallow
  }
}
