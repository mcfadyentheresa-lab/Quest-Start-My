import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface RouteErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Standard "this page failed to load" panel with a Retry action. Used as
 * the error state for primary route data fetches. */
export function RouteError({
  title = "We couldn't load this page",
  message = "Something went wrong fetching your data. Please try again.",
  onRetry,
}: RouteErrorProps) {
  return (
    <Alert variant="destructive" className="rounded-2xl">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5 self-start"
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
