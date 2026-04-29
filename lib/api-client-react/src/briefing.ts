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

export type BriefingItem = {
  taskId: string | number | null;
  title: string;
  pillarName: string;
  pillarColor: string | null;
  priority: "P1" | "P2" | "P3" | "P4";
  reasoning: string;
  estimatedMinutes: number;
  suggestedNextStep: string | null;
  blockedBy: string | null;
};

export type BriefingResponse = {
  greeting: string;
  headline: string;
  context: string;
  briefing: BriefingItem[];
  signoff: string;
  date: string;
  source: "ai" | "rules" | "fallback";
  approved: boolean;
  generatedAt: string;
};

export type BriefingActionResponse = {
  ok: boolean;
  briefing: BriefingResponse | null;
};

const BRIEFING_TODAY_URL = "/api/briefing/today";
const BRIEFING_RESHUFFLE_URL = "/api/briefing/reshuffle";
const BRIEFING_APPROVE_URL = "/api/briefing/approve";

export const getBriefingTodayUrl = () => BRIEFING_TODAY_URL;

export const getBriefingTodayQueryKey = () => [BRIEFING_TODAY_URL] as const;

export const getBriefingToday = async (
  options?: RequestInit,
): Promise<BriefingResponse> => {
  return customFetch<BriefingResponse>(BRIEFING_TODAY_URL, {
    ...options,
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: options?.body ?? JSON.stringify({}),
  });
};

export function useGetBriefingToday<
  TData = BriefingResponse,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<BriefingResponse, TError, TData>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getBriefingTodayQueryKey();
  const queryFn: QueryFunction<BriefingResponse> = ({ signal }) =>
    getBriefingToday({ signal });
  const query = useQuery({
    queryKey,
    queryFn,
    ...(options?.query ?? {}),
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const reshuffleBriefing = async (body?: {
  hint?: string;
}): Promise<BriefingResponse> => {
  return customFetch<BriefingResponse>(BRIEFING_RESHUFFLE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
};

export const approveBriefing = async (): Promise<BriefingActionResponse> => {
  return customFetch<BriefingActionResponse>(BRIEFING_APPROVE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
};

export function useReshuffleBriefing<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<
    BriefingResponse,
    TError,
    { hint?: string } | void
  >;
}): UseMutationResult<BriefingResponse, TError, { hint?: string } | void> {
  return useMutation({
    mutationFn: (vars: { hint?: string } | void) =>
      reshuffleBriefing(vars ?? undefined),
    ...(options?.mutation ?? {}),
  });
}

export function useApproveBriefing<TError = ErrorType<unknown>>(options?: {
  mutation?: UseMutationOptions<BriefingActionResponse, TError, void>;
}): UseMutationResult<BriefingActionResponse, TError, void> {
  return useMutation({
    mutationFn: () => approveBriefing(),
    ...(options?.mutation ?? {}),
  });
}
