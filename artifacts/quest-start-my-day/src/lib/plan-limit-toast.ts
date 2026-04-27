// Helper for surfacing PLAN_LIMIT errors from mutations gracefully. Pairs
// with the backend ApiError({ status: 403, code: "PLAN_LIMIT", details })
// envelope; recognizable shape without depending on the api-client-react
// ApiError type so any caller (mutation onError, raw try/catch) can use it.
import { toast } from "@/hooks/use-toast";
import { isBillingEnabled } from "@/lib/billing-config";

export interface PlanLimitErrorDetails {
  code: "PLAN_LIMIT";
  resource: "pillars" | "tasks" | "export";
  limit: number;
  current: number;
  plan: "free" | "pro";
}

export interface PlanLimitErrorBody {
  error: {
    code: string;
    message: string;
    details?: PlanLimitErrorDetails;
  };
}

interface ErrorLike {
  status?: number;
  data?: PlanLimitErrorBody;
}

export function isPlanLimitError(err: unknown): err is ErrorLike & { data: PlanLimitErrorBody } {
  if (!err || typeof err !== "object") return false;
  const e = err as ErrorLike;
  if (e.status !== 403) return false;
  return e.data?.error?.code === "PLAN_LIMIT";
}

export function showPlanLimitToast(err: unknown): boolean {
  if (!isPlanLimitError(err)) return false;
  const message = err.data?.error?.message ?? "You've hit a plan limit.";
  const description = isBillingEnabled()
    ? `${message} Visit /billing to upgrade.`
    : message;
  toast({
    title: "Plan limit reached",
    description,
    variant: "destructive",
  });
  return true;
}
