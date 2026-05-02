import { useQuery } from "@tanstack/react-query";
import type {
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

export type YearRibbonWeek = {
  index: number;
  completedTasks: number;
  createdTasks: number;
  closedSteps: number;
};

export type YearRibbonGoalBar = {
  goalId: number;
  title: string;
  startWeek: number;
  endWeek: number;
  status: string;
  isOnHold: boolean;
};

export type YearRibbonArea = {
  id: number;
  name: string;
  priority: string;
  color: string | null;
  category: string | null;
  weeks: YearRibbonWeek[];
  goalBars: YearRibbonGoalBar[];
};

export type YearRibbonResponse = {
  year: number;
  weeks: number;
  todayWeekIndex: number | null;
  areas: YearRibbonArea[];
};

const YEAR_RIBBON_URL = "/api/year-ribbon";

export const getYearRibbonUrl = (year: number) => `${YEAR_RIBBON_URL}?year=${year}`;

export const getYearRibbonQueryKey = (year: number) => [YEAR_RIBBON_URL, year] as const;

export const getYearRibbon = async (
  year: number,
  options?: RequestInit,
): Promise<YearRibbonResponse> => {
  return customFetch<YearRibbonResponse>(getYearRibbonUrl(year), {
    ...options,
    method: "GET",
  });
};

export function useGetYearRibbon<
  TData = YearRibbonResponse,
  TError = ErrorType<unknown>,
>(
  year: number,
  options?: {
    query?: UseQueryOptions<YearRibbonResponse, TError, TData>;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getYearRibbonQueryKey(year);
  const queryFn: QueryFunction<YearRibbonResponse> = ({ signal }) =>
    getYearRibbon(year, { signal });
  const query = useQuery({
    queryKey,
    queryFn,
    ...(options?.query ?? {}),
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}
