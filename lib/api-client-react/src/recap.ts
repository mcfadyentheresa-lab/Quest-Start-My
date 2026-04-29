import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type RecapTaskRef = {
  taskId: number | null;
  title: string;
  pillarName: string;
  pillarColor: string | null;
};

export type RecapResponse = {
  greeting: string;
  headline: string;
  closedToday: RecapTaskRef[];
  rolledToTomorrow: RecapTaskRef[];
  areaBreakdown: string;
  reflectionPrompt: string;
  reflection: string | null;
  signoff: string;
  date: string;
  source: "ai" | "rules" | "fallback";
  generatedAt: string;
};

const RECAP_URL = "/api/dashboard/recap";
const RECAP_REGENERATE_URL = "/api/dashboard/recap/regenerate";
const RECAP_REFLECTION_URL = "/api/dashboard/recap/reflection";

export const getDashboardRecapQueryKey = () => [RECAP_URL] as const;

export const getDashboardRecap = async (
  options?: RequestInit,
): Promise<RecapResponse> => {
  return customFetch<RecapResponse>(RECAP_URL, {
    ...options,
    method: "GET",
  });
};

export function useGetDashboardRecap<
  TData = RecapResponse,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<RecapResponse, TError, TData>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getDashboardRecapQueryKey();
  const queryFn: QueryFunction<RecapResponse> = ({ signal }) =>
    getDashboardRecap({ signal });
  const query = useQuery({
    queryKey,
    queryFn,
    ...(options?.query ?? {}),
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const regenerateRecap = async (): Promise<RecapResponse> => {
  return customFetch<RecapResponse>(RECAP_REGENERATE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
};

export function useRegenerateRecap<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<RecapResponse, TError, void>;
}): UseMutationResult<RecapResponse, TError, void> {
  return useMutation({
    mutationFn: () => regenerateRecap(),
    ...(options?.mutation ?? {}),
  });
}

export const saveRecapReflection = async (
  reflection: string,
): Promise<RecapResponse> => {
  return customFetch<RecapResponse>(RECAP_REFLECTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reflection }),
  });
};

export function useSaveRecapReflection<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<RecapResponse, TError, { reflection: string }>;
}): UseMutationResult<RecapResponse, TError, { reflection: string }> {
  return useMutation({
    mutationFn: (vars: { reflection: string }) =>
      saveRecapReflection(vars.reflection),
    ...(options?.mutation ?? {}),
  });
}
