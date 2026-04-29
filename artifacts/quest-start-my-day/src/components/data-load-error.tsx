import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Reusable error state for failed data loads.
 *
 * Show this when a React Query hook reports `isError` (after the
 * built-in retries have all failed). Replaces infinite skeletons
 * with a clear message + retry affordance so the user is never
 * stuck staring at a loading shimmer.
 */
export function DataLoadError({
  title = "Couldn't load this section",
  message = "Check your connection and try again. If this keeps happening, your data is safe — the app just can't reach it right now.",
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="data-load-error"
      className={
        compact
          ? "rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-900/10 p-4 flex items-start gap-3"
          : "rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-900/10 p-7 text-center"
      }
    >
      {compact ? (
        <>
          <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl mt-2 h-8"
                onClick={onRetry}
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Try again
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <AlertCircle className="size-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
          <p className="font-serif text-base text-foreground mb-1">{title}</p>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {message}
          </p>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={onRetry}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Try again
            </Button>
          )}
        </>
      )}
    </div>
  );
}
