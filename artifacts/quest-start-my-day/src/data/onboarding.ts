import { useQuery, useMutation, type UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  onboardedAt: string | null;
  dismissedChecklist: string | null;
}

export interface CompleteOnboardingBody {
  templateId?: string;
  customPillars?: { name: string; color?: string; portfolioStatus?: "Active" | "Warm" | "Dormant" }[];
}

export interface CompleteOnboardingResponse {
  onboardedAt: string | null;
  pillarsCreated: number;
  alreadyOnboarded: boolean;
}

export const ME_QUERY_KEY = ["/api/me"] as const;

export function useMe(): UseQueryResult<MeResponse, Error> {
  return useQuery<MeResponse, Error>({
    queryKey: ME_QUERY_KEY,
    queryFn: () => customFetch<MeResponse>("/api/me"),
  });
}

export function useCompleteOnboarding() {
  return useMutation<CompleteOnboardingResponse, Error, CompleteOnboardingBody>({
    mutationFn: (body) =>
      customFetch<CompleteOnboardingResponse>("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useDismissChecklist() {
  return useMutation<{ dismissedChecklist: string | null }, Error, void>({
    mutationFn: () =>
      customFetch<{ dismissedChecklist: string | null }>("/api/onboarding/dismiss-checklist", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}

export interface OnboardingTriggerInputs {
  user: Pick<MeResponse, "onboardedAt"> | undefined;
  pillarCount: number | undefined;
  isLoading: boolean;
}

/**
 * Returns true when the welcome wizard should be shown:
 *   - data is loaded (not loading)
 *   - user.onboardedAt is null
 *   - user has zero pillars
 *
 * Theresa already has 7 pillars, so the wizard never triggers for her.
 */
export function shouldShowWizard({ user, pillarCount, isLoading }: OnboardingTriggerInputs): boolean {
  if (isLoading) return false;
  if (!user) return false;
  if (user.onboardedAt) return false;
  if (pillarCount === undefined) return false;
  return pillarCount === 0;
}

export interface ChecklistInputs {
  user: Pick<MeResponse, "onboardedAt" | "dismissedChecklist"> | undefined;
}

export function shouldShowChecklist({ user }: ChecklistInputs): boolean {
  if (!user) return false;
  if (!user.onboardedAt) return false;
  if (user.dismissedChecklist) return false;
  return true;
}
