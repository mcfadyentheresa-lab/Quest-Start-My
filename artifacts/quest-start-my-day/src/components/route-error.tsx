import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function RouteError({
  title = "Couldn't load this page",
  description = "Something went wrong fetching the data. Try again in a moment.",
  onRetry,
}: RouteErrorProps) {
  return (
    <div
      role="alert"
      className="text-center py-12 rounded-2xl bg-card border border-dashed border-rose-200 dark:border-rose-900/30 px-6"
    >
      <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{description}</p>
      {onRetry && (
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}
