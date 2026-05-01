import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  useListWeeklyPlans,
  useCreateWeeklyPlan,
  useUpdateWeeklyPlan,
  useListAreas,
  useUpdateArea,
  useGetDashboardSummary,
  getListWeeklyPlansQueryKey,
  getListAreasQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PriorityBadge } from "@/components/priority-badge";
import { ReflectionForm, type ReflectionValues } from "@/components/reflection-form";
import { Check, ChevronDown, ChevronUp, Flame, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function formatWeek(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

const NOTES_DEBOUNCE_MS = 800;

export default function WeeklyPage() {
  const weekOf = getWeekStart();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: weeklyPlans, isLoading: plansLoading } = useListWeeklyPlans(
    { weekOf },
    { query: { queryKey: getListWeeklyPlansQueryKey({ weekOf }) } }
  );
  const { data: areas, isLoading: areasLoading } = useListAreas();
  const { data: dashboardSummary } = useGetDashboardSummary();

  const createPlan = useCreateWeeklyPlan();
  const updatePlan = useUpdateWeeklyPlan();
  const updateArea = useUpdateArea();

  const existingPlan = weeklyPlans?.[0];

  const [notes, setNotes] = useState("");
  const [notesStatus, setNotesStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [reflection, setReflection] = useState<ReflectionValues>({
    moved: "",
    stuck: "",
    drop: "",
    nextFocus: "",
  });
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotes = useRef<string>("");

  useEffect(() => {
    if (existingPlan) {
      const initialNotes = existingPlan.notes ?? "";
      setNotes(initialNotes);
      lastSavedNotes.current = initialNotes;
      setReflection({
        moved: existingPlan.whatMovedForward ?? "",
        stuck: existingPlan.whatGotStuck ?? "",
        drop: existingPlan.whatToDeprioritize ?? "",
        nextFocus: existingPlan.nextWeekFocus ?? "",
      });
      if (existingPlan.whatMovedForward || existingPlan.whatGotStuck || existingPlan.whatToDeprioritize || existingPlan.nextWeekFocus) {
        setReflectionOpen(true);
      }
    }
  }, [existingPlan]);

  const persistNotes = async (next: string) => {
    if (next === lastSavedNotes.current) return;
    setNotesStatus("saving");
    try {
      if (existingPlan) {
        await updatePlan.mutateAsync({
          id: existingPlan.id,
          data: { notes: next || undefined },
        });
      } else {
        await createPlan.mutateAsync({
          data: {
            weekOf,
            priorities: [],
            notes: next || undefined,
            areaPriorities: areas?.filter(a => a.isActiveThisWeek).map(a => a.id) ?? [],
          },
        });
      }
      lastSavedNotes.current = next;
      queryClient.invalidateQueries({ queryKey: getListWeeklyPlansQueryKey({ weekOf }) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setNotesStatus("saved");
    } catch {
      setNotesStatus("idle");
      toast({ title: "Couldn't save notes", variant: "destructive" });
    }
  };

  const handleNotesChange = (next: string) => {
    setNotes(next);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      void persistNotes(next);
    }, NOTES_DEBOUNCE_MS);
  };

  const handleNotesBlur = () => {
    if (notesDebounceRef.current) {
      clearTimeout(notesDebounceRef.current);
      notesDebounceRef.current = null;
    }
    void persistNotes(notes);
  };

  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    };
  }, []);

  const saveReflection = async (next: ReflectionValues) => {
    setReflection(next);
    setSavingReflection(true);
    try {
      const payload = {
        whatMovedForward: next.moved || undefined,
        whatGotStuck: next.stuck || undefined,
        whatToDeprioritize: next.drop || undefined,
        nextWeekFocus: next.nextFocus || undefined,
      };
      if (existingPlan) {
        await updatePlan.mutateAsync({ id: existingPlan.id, data: payload });
      } else {
        await createPlan.mutateAsync({
          data: {
            weekOf,
            priorities: [],
            areaPriorities: areas?.filter(a => a.isActiveThisWeek).map(a => a.id) ?? [],
            ...payload,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListWeeklyPlansQueryKey({ weekOf }) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Reflection saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingReflection(false);
    }
  };

  const toggleAreaActive = async (areaId: number, currentlyActive: boolean) => {
    await updateArea.mutateAsync(
      { id: areaId, data: { isActiveThisWeek: !currentlyActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      }
    );
  };

  if (plansLoading || areasLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const activeAreas = (areas ?? []).filter(a => a.isActiveThisWeek);
  const hasActiveArea = activeAreas.length > 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">This week</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{formatWeek(weekOf)}</p>
        </div>
        {dashboardSummary && dashboardSummary.planningStreak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
            <Flame className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {dashboardSummary.planningStreak} {dashboardSummary.planningStreak === 1 ? "week" : "weeks"}
            </span>
          </div>
        )}
      </motion.div>

      {/* Active areas */}
      <section>
        <h2 className="font-serif text-base font-medium text-foreground mb-1">Active areas</h2>
        <p className="text-xs text-muted-foreground mb-3" data-testid="active-areas-explainer">
          Pick the areas to focus on this week. Today's plan is drafted from these.
        </p>
        <div className="space-y-2">
          {areas?.map(area => (
            <div
              key={area.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                area.isActiveThisWeek
                  ? "bg-card border-primary/30"
                  : "bg-muted/30 border-border opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {area.color && (
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }} />
                )}
                <div>
                  <span className="text-sm font-medium text-foreground">{area.name}</span>
                  {area.description && <p className="text-xs text-muted-foreground mt-0.5">{area.description}</p>}
                </div>
                <PriorityBadge priority={area.priority} />
              </div>
              <button
                onClick={() => toggleAreaActive(area.id, area.isActiveThisWeek)}
                className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  area.isActiveThisWeek
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-transparent border-border text-muted-foreground"
                }`}
                aria-label={area.isActiveThisWeek ? `Deactivate ${area.name} this week` : `Activate ${area.name} this week`}
                aria-pressed={area.isActiveThisWeek}
              >
                {area.isActiveThisWeek && <Check className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3" data-testid="active-areas-next-step">
          {hasActiveArea ? (
            <Link href="/today">
              <a
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                data-testid="see-todays-plan"
              >
                See today's plan
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="pick-an-area-helper">
              Pick at least one area to draft this week.
            </p>
          )}
        </div>
      </section>

      {/* This week's focus — derived from active areas */}
      <section className="rounded-2xl bg-card border border-card-border p-5 space-y-4" data-testid="weekly-focus-card">
        <div>
          <h2 className="font-serif text-base font-medium text-foreground">This week's focus</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drafted from your active areas. Tap an area to change priority.
          </p>
        </div>

        {activeAreas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No active areas yet. Pick one above and the focus drafts itself.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="active-areas-summary">
            {activeAreas.map(area => (
              <Link key={area.id} href={`/areas/${area.id}`}>
                <a
                  className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  data-testid={`focus-pill-${area.id}`}
                >
                  {area.color && (
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }} />
                  )}
                  <span className="font-medium text-foreground">{area.name}</span>
                  <PriorityBadge priority={area.priority} />
                </a>
              </Link>
            ))}
          </div>
        )}

        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="weekly-anything-else">Anything else this week?</Label>
            {notesStatus === "saving" && (
              <span className="text-xs text-muted-foreground" data-testid="notes-saving">Saving…</span>
            )}
            {notesStatus === "saved" && (
              <span className="text-xs text-muted-foreground" data-testid="notes-saved">Saved · just now</span>
            )}
          </div>
          <Textarea
            id="weekly-anything-else"
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="A meeting, a deadline, a feeling. Optional."
            className="rounded-xl resize-none"
            rows={3}
          />
        </div>
      </section>

      {/* Weekly reflection */}
      <section className="rounded-2xl bg-card border border-card-border overflow-hidden">
        <button
          onClick={() => setReflectionOpen(!reflectionOpen)}
          className="w-full flex items-center justify-between p-5 text-left"
          aria-expanded={reflectionOpen}
        >
          <div>
            <h2 className="font-serif text-base font-medium text-foreground">Weekly reflection</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Review what happened this week</p>
          </div>
          {reflectionOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        </button>

        <AnimatePresence initial={false}>
          {reflectionOpen && (
            <motion.div
              key="reflection"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-border pt-4">
                <ReflectionForm
                  cadence="week"
                  periodKey={weekOf}
                  value={reflection}
                  onSave={saveReflection}
                  saving={savingReflection}
                  saveLabel="Save reflection"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
