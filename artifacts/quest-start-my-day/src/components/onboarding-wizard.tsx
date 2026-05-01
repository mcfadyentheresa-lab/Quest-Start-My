import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCreateArea,
  getListAreasQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ArrowRight, Sunrise } from "lucide-react";
import { STARTER_AREAS } from "@/lib/starter-areas";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "quest_onboarding_complete_v1";

export function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable — onboarding will reappear next session
  }
}

type Step = "welcome" | "areas" | "briefing";

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingWizard({ open, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const createArea = useCreateArea();
  const { toast } = useToast();

  const toggleArea = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selected = useMemo(
    () => STARTER_AREAS.filter(a => selectedNames.has(a.name)),
    [selectedNames]
  );

  const finishWithoutAreas = () => {
    markOnboardingComplete();
    onComplete();
  };

  const handleCreateSelected = async () => {
    if (selected.length === 0) {
      setStep("briefing");
      return;
    }
    setCreating(true);
    let added = 0;
    let failed = 0;
    for (const area of selected) {
      await new Promise<void>((resolve) => {
        createArea.mutate(
          {
            data: {
              name: area.name,
              priority: "P2",
              description: area.description,
              isActiveThisWeek: true,
              color: area.color,
              portfolioStatus: "Active",
              category: area.category,
            },
          },
          {
            onSuccess: () => { added++; },
            onError: () => { failed++; },
            onSettled: () => resolve(),
          }
        );
      });
    }
    queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    setCreating(false);
    if (failed > 0 && added === 0) {
      toast({ title: "Could not add areas", description: "You can add them later in Settings.", variant: "destructive" });
    } else if (added > 0) {
      toast({ title: `${added} area${added !== 1 ? "s" : ""} added` });
    }
    setStep("briefing");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) finishWithoutAreas(); }}>
      <DialogContent className="rounded-2xl w-[calc(100%-2rem)] max-w-md p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader>
                <div className="flex items-center justify-center mb-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <DialogTitle className="font-serif text-2xl text-center">Welcome to Quest</DialogTitle>
                <DialogDescription className="text-center">
                  Quest is a quiet chief-of-staff for your day. Each morning you'll get a short briefing on what matters most, and a small list of tasks to move it forward.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex flex-col gap-2">
                <Button className="rounded-xl gap-1.5" onClick={() => setStep("areas")} data-testid="onboarding-start">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={finishWithoutAreas}
                  data-testid="onboarding-skip-welcome"
                >
                  Skip for now
                </Button>
              </div>
            </motion.div>
          )}

          {step === "areas" && (
            <motion.div
              key="areas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Pick a few areas (optional)</DialogTitle>
                <DialogDescription>
                  Areas are lightweight tags for grouping tasks — like Operations, Family, or Health. You can pick a few starters now, or skip and add your own later.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {STARTER_AREAS.map(area => {
                  const checked = selectedNames.has(area.name);
                  return (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => toggleArea(area.name)}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all flex items-start gap-3 ${
                        checked
                          ? "border-primary/60 bg-primary/5"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                      data-testid={`starter-area-${area.name.toLowerCase()}`}
                      aria-pressed={checked}
                    >
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: area.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{area.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{area.description}</p>
                      </div>
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <Button
                  className="rounded-xl gap-1.5"
                  onClick={handleCreateSelected}
                  disabled={creating}
                  data-testid="onboarding-areas-continue"
                >
                  {creating ? "Adding…" : selected.length > 0 ? `Add ${selected.length} area${selected.length !== 1 ? "s" : ""}` : "Continue without areas"}
                  {!creating && <ArrowRight className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => setStep("briefing")}
                  data-testid="onboarding-skip-areas"
                >
                  Skip — I'll add areas later
                </Button>
              </div>
            </motion.div>
          )}

          {step === "briefing" && (
            <motion.div
              key="briefing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader>
                <div className="flex items-center justify-center mb-3">
                  <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Sunrise className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <DialogTitle className="font-serif text-xl text-center">Your morning briefing</DialogTitle>
                <DialogDescription className="text-center">
                  Tomorrow morning, you'll see a short briefing at the top of your dashboard — what matters today, what's stuck, and the smallest next step. Think of it as a chief of staff who's already read your week.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  className="rounded-xl"
                  onClick={() => { markOnboardingComplete(); onComplete(); }}
                  data-testid="onboarding-finish"
                >
                  Take me to my dashboard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
