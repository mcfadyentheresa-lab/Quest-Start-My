import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, X, Sunrise, Layers, ListChecks } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "quest_checklist_state_v1";
const BRIEFING_VIEWED_KEY = "quest_briefing_viewed_v1";
// Set once the user has crossed the "mostly set up" threshold (≥2 of 3
// items complete). Once set, the checklist no longer renders even if a
// later state somehow drops back below the threshold.
const AUTO_DISMISSED_KEY = "onboardingChecklistDismissed";

export type ChecklistItemId = "set-up-areas" | "read-briefing" | "add-first-task";

interface PersistedState {
  dismissed: boolean;
  manuallyCompleted: ChecklistItemId[];
}

function readState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: false, manuallyCompleted: [] };
    const parsed = JSON.parse(raw);
    return {
      dismissed: !!parsed.dismissed,
      manuallyCompleted: Array.isArray(parsed.manuallyCompleted) ? parsed.manuallyCompleted : [],
    };
  } catch {
    return { dismissed: false, manuallyCompleted: [] };
  }
}

function writeState(s: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable — checklist resets next session
  }
}

export function markBriefingViewed() {
  try {
    localStorage.setItem(BRIEFING_VIEWED_KEY, "true");
  } catch {
    // localStorage unavailable — auto-complete won't persist
  }
}

function readBriefingViewed(): boolean {
  try {
    return localStorage.getItem(BRIEFING_VIEWED_KEY) === "true";
  } catch {
    return false;
  }
}

function readAutoDismissed(): boolean {
  try {
    return localStorage.getItem(AUTO_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAutoDismissed() {
  try {
    localStorage.setItem(AUTO_DISMISSED_KEY, "1");
  } catch {
    // localStorage unavailable — auto-dismiss won't persist
  }
}

interface OnboardingChecklistProps {
  hasAreas: boolean;
  hasTasks: boolean;
}

export function OnboardingChecklist({ hasAreas, hasTasks }: OnboardingChecklistProps) {
  const [state, setState] = useState<PersistedState>(() => readState());
  const [briefingViewed, setBriefingViewed] = useState<boolean>(() => readBriefingViewed());
  const [autoDismissed, setAutoDismissed] = useState<boolean>(() => readAutoDismissed());

  useEffect(() => {
    const interval = setInterval(() => {
      const v = readBriefingViewed();
      if (v !== briefingViewed) setBriefingViewed(v);
    }, 1000);
    return () => clearInterval(interval);
  }, [briefingViewed]);

  const items: { id: ChecklistItemId; label: string; description: string; icon: typeof Layers; href?: string; done: boolean }[] = [
    {
      id: "set-up-areas",
      label: "Set up your areas (optional)",
      description: "Group tasks into lightweight categories like Operations or Family",
      icon: Layers,
      href: "/settings",
      done: hasAreas || state.manuallyCompleted.includes("set-up-areas"),
    },
    {
      id: "read-briefing",
      label: "Read your morning briefing",
      description: "A short take on what matters today — appears on your dashboard each morning",
      icon: Sunrise,
      done: briefingViewed || state.manuallyCompleted.includes("read-briefing"),
    },
    {
      id: "add-first-task",
      label: "Add your first task",
      description: "Up to three things you want to move today",
      icon: ListChecks,
      href: "/today",
      done: hasTasks || state.manuallyCompleted.includes("add-first-task"),
    },
  ];

  const allDone = items.every(i => i.done);
  const doneCount = items.filter(i => i.done).length;

  // Auto-dismiss when everything is complete (give a brief celebratory moment first).
  useEffect(() => {
    if (!allDone || state.dismissed) return;
    const t = setTimeout(() => {
      const next = { ...state, dismissed: true };
      setState(next);
      writeState(next);
    }, 4000);
    return () => clearTimeout(t);
  }, [allDone, state]);

  // Auto-dismiss once the user has completed ≥2 of 3 items. The card
  // has done its job at that point; keeping it around past that just
  // adds visual noise to a Today page we're trying to quiet down.
  useEffect(() => {
    if (autoDismissed) return;
    if (doneCount >= 2) {
      writeAutoDismissed();
      setAutoDismissed(true);
    }
  }, [doneCount, autoDismissed]);

  if (state.dismissed || autoDismissed) return null;

  const dismiss = () => {
    const next = { ...state, dismissed: true };
    setState(next);
    writeState(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4"
      data-testid="onboarding-checklist"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-serif text-base font-medium text-foreground">Get set up</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allDone ? "All set — nice work." : "A few quick things to make Quest yours."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={dismiss}
          aria-label="Dismiss checklist"
          data-testid="checklist-dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map(item => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5"
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                {item.href && !item.done ? (
                  <Link href={item.href}>
                    <span className="text-sm font-medium text-foreground hover:text-primary cursor-pointer transition-colors">
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.label}
                  </span>
                )}
                {!item.done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
