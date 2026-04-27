import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPillars,
  getListPillarsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  ME_QUERY_KEY,
  shouldShowWizard,
  useCompleteOnboarding,
  useMe,
} from "@/data/onboarding";
import { STARTER_TEMPLATES, type StarterPillar } from "@/lib/starter-templates";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sprout, Trash2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

type Step = 1 | 2 | 3 | 4;

interface DraftPillar {
  name: string;
  color: string;
  portfolioStatus: "Active" | "Warm" | "Dormant";
}

function pillarsFromTemplate(templateId: string): DraftPillar[] {
  const tpl = STARTER_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return [];
  return tpl.pillars.map((p: StarterPillar) => ({
    name: p.name,
    color: p.color,
    portfolioStatus: p.portfolioStatus,
  }));
}

export default function WelcomePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const pillarsQuery = useListPillars();
  const completeMutation = useCompleteOnboarding();

  const [step, setStep] = useState<Step>(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draftPillars, setDraftPillars] = useState<DraftPillar[]>([]);

  const isLoading = meQuery.isLoading || pillarsQuery.isLoading;
  const showGuard = useMemo(() => {
    if (isLoading) return "loading";
    const eligible = shouldShowWizard({
      user: meQuery.data,
      pillarCount: pillarsQuery.data?.length,
      isLoading,
    });
    if (!eligible) return "skip";
    return "show";
  }, [isLoading, meQuery.data, pillarsQuery.data]);

  // If the user is already onboarded or has pillars, bounce them to the dashboard.
  useEffect(() => {
    if (showGuard === "skip") {
      navigate("/", { replace: true });
    }
  }, [showGuard, navigate]);

  if (showGuard !== "show") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {showGuard === "loading" ? "Loading…" : "You're already set up — redirecting."}
      </div>
    );
  }

  const handlePickTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setDraftPillars(pillarsFromTemplate(id));
    trackEvent("template_selected", { templateId: id });
    setStep(3);
  };

  const handleStartBlank = () => {
    setSelectedTemplateId(null);
    setDraftPillars([]);
    setStep(3);
  };

  const handleEditPillarName = (idx: number, name: string) => {
    setDraftPillars((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], name };
      return next;
    });
  };

  const handleRemovePillar = (idx: number) => {
    setDraftPillars((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddBlankPillar = () => {
    setDraftPillars((prev) => [
      ...prev,
      { name: "", color: "#3b82f6", portfolioStatus: "Active" },
    ]);
  };

  const handleFinish = async () => {
    const cleaned = draftPillars
      .map((p) => ({ ...p, name: p.name.trim() }))
      .filter((p) => p.name.length > 0);

    try {
      if (selectedTemplateId && cleanedMatchesTemplate(cleaned, selectedTemplateId)) {
        await completeMutation.mutateAsync({ templateId: selectedTemplateId });
      } else if (cleaned.length > 0) {
        await completeMutation.mutateAsync({
          customPillars: cleaned.map((p) => ({
            name: p.name,
            color: p.color,
            portfolioStatus: p.portfolioStatus,
          })),
        });
      } else {
        await completeMutation.mutateAsync({});
      }

      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });

      trackEvent("onboarding_completed", {
        pillarCount: cleaned.length,
        templateId: selectedTemplateId,
      });
      toast({ title: "You're all set", description: "Welcome to Quest." });
      navigate("/", { replace: true });
    } catch (err) {
      toast({
        title: "Could not finish setup",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <StepIndicator step={step} />

        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sprout className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <CardTitle>Welcome to Quest</CardTitle>
              <CardDescription>
                Quest helps you focus on the few things that matter. We'll set up your pillars in a couple of minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end">
              <Button onClick={() => setStep(2)} data-testid="welcome-next">
                Get started <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Pick a starting point</CardTitle>
              <CardDescription>
                Choose a template that fits where you are right now. You can edit everything in the next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {STARTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handlePickTemplate(tpl.id)}
                  className="w-full rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid={`template-${tpl.id}`}
                >
                  <div className="font-medium">{tpl.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{tpl.description}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tpl.pillars.map((p) => (
                      <span
                        key={p.name}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                      >
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={handleStartBlank}
                className="w-full rounded-lg border border-dashed p-4 text-left text-sm text-muted-foreground hover:border-primary hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="start-blank"
              >
                Start blank — I'll add my own.
              </button>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm your pillars</CardTitle>
              <CardDescription>
                Edit names or remove any that don't fit. You can always add more later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draftPillars.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No pillars yet. Add one below or skip — you can create them after onboarding.
                </p>
              )}

              {draftPillars.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <Input
                    value={p.name}
                    onChange={(e) => handleEditPillarName(idx, e.target.value)}
                    placeholder="Pillar name"
                    aria-label={`Pillar ${idx + 1} name`}
                    data-testid={`pillar-name-${idx}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePillar(idx)}
                    aria-label={`Remove ${p.name || "pillar"}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={handleAddBlankPillar} className="w-full">
                Add another pillar
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Back
                </Button>
                <Button onClick={() => setStep(4)} data-testid="confirm-pillars">
                  These look good <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>This week's priorities</CardTitle>
              <CardDescription>
                Once you finish setup, you can pick your P1/P2/P3 for the week from the Weekly tab. This is optional — you can come back to it anytime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {draftPillars
                  .filter((p) => p.name.trim().length > 0)
                  .slice(0, 3)
                  .map((p, idx) => (
                    <li key={idx} className="flex items-center gap-2 rounded-md border p-2">
                      <span className="font-medium">P{idx + 1}</span>
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span>{p.name}</span>
                    </li>
                  ))}
                {draftPillars.filter((p) => p.name.trim().length > 0).length === 0 && (
                  <li className="text-muted-foreground">No pillars yet — set them later from the Pillars tab.</li>
                )}
              </ul>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={completeMutation.isPending}
                  data-testid="finish-setup"
                >
                  {completeMutation.isPending ? (
                    "Finishing…"
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" aria-hidden /> Finish setup
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function cleanedMatchesTemplate(cleaned: DraftPillar[], templateId: string): boolean {
  const tpl = STARTER_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return false;
  if (cleaned.length !== tpl.pillars.length) return false;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i].name !== tpl.pillars[i].name) return false;
    if (cleaned[i].color !== tpl.pillars[i].color) return false;
  }
  return true;
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={`h-1.5 w-12 rounded-full ${n <= step ? "bg-primary" : "bg-muted"}`}
          aria-hidden
        />
      ))}
      <span className="ml-2">Step {step} of 4</span>
    </div>
  );
}
