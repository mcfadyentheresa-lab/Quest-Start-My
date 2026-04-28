import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PriorityBadge } from "@/components/priority-badge";
import { Plus, Trash2, Check, Loader2, ChevronDown, ChevronUp, Flame } from "lucide-react";
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

  const [priorities, setPriorities] = useState<string[]>([""]);
  const [healthFocus, setHealthFocus] = useState("");
  const [businessFocus, setBusinessFocus] = useState("");
  const [creativeFocus, setCreativeFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [whatMovedForward, setWhatMovedForward] = useState("");
  const [whatGotStuck, setWhatGotStuck] = useState("");
  const [whatContinues, setWhatContinues] = useState("");
  const [whatToDeprioritize, setWhatToDeprioritize] = useState("");
  const [nextWeekFocus, setNextWeekFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);

  useEffect(() => {
    if (existingPlan) {
      setPriorities(existingPlan.priorities.length > 0 ? existingPlan.priorities : [""]);
      setHealthFocus(existingPlan.healthFocus ?? "");
      setBusinessFocus(existingPlan.businessFocus ?? "");
      setCreativeFocus(existingPlan.creativeFocus ?? "");
      setNotes(existingPlan.notes ?? "");
      setWhatMovedForward(existingPlan.whatMovedForward ?? "");
      setWhatGotStuck(existingPlan.whatGotStuck ?? "");
      setWhatContinues(existingPlan.whatContinues ?? "");
      setWhatToDeprioritize(existingPlan.whatToDeprioritize ?? "");
      setNextWeekFocus(existingPlan.nextWeekFocus ?? "");
      // Open reflection if they have content
      if (existingPlan.whatMovedForward || existingPlan.whatGotStuck || existingPlan.whatContinues || existingPlan.whatToDeprioritize || existingPlan.nextWeekFocus) {
        setReflectionOpen(true);
      }
    }
  }, [existingPlan]);

  const save = async () => {
    const cleanPriorities = priorities.filter(p => p.trim());
    setSaving(true);
    try {
      if (existingPlan) {
        await updatePlan.mutateAsync({
          id: existingPlan.id,
          data: {
            priorities: cleanPriorities,
            healthFocus: healthFocus || undefined,
            businessFocus: businessFocus || undefined,
            creativeFocus: creativeFocus || undefined,
            notes: notes || undefined,
            whatMovedForward: whatMovedForward || undefined,
            whatGotStuck: whatGotStuck || undefined,
            whatContinues: whatContinues || undefined,
            whatToDeprioritize: whatToDeprioritize || undefined,
            nextWeekFocus: nextWeekFocus || undefined,
          },
        });
      } else {
        await createPlan.mutateAsync({
          data: {
            weekOf,
            priorities: cleanPriorities,
            healthFocus: healthFocus || undefined,
            businessFocus: businessFocus || undefined,
            creativeFocus: creativeFocus || undefined,
            notes: notes || undefined,
            whatMovedForward: whatMovedForward || undefined,
            whatGotStuck: whatGotStuck || undefined,
            whatContinues: whatContinues || undefined,
            whatToDeprioritize: whatToDeprioritize || undefined,
            nextWeekFocus: nextWeekFocus || undefined,
            areaPriorities: areas?.filter(p => p.isActiveThisWeek).map(p => p.id) ?? [],
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListWeeklyPlansQueryKey({ weekOf }) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Weekly plan saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
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
        <h2 className="font-serif text-base font-medium text-foreground mb-3">Active areas</h2>
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
      </section>

      {/* Weekly plan form */}
      <section className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
        <h2 className="font-serif text-base font-medium text-foreground">Weekly plan</h2>

        {/* Priorities */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top priorities</p>
          {priorities.map((p, i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`weekly-priority-${i + 1}`} className="text-xs text-muted-foreground">Priority {i + 1}</Label>
              <div className="flex gap-2">
              <Input
                id={`weekly-priority-${i + 1}`}
                value={p}
                onChange={e => {
                  const next = [...priorities];
                  next[i] = e.target.value;
                  setPriorities(next);
                }}
                placeholder={`Priority ${i + 1}`}
                className="rounded-xl flex-1"
              />
              {priorities.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl text-muted-foreground"
                  onClick={() => setPriorities(priorities.filter((_, j) => j !== i))}
                  aria-label={`Remove priority ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={() => setPriorities([...priorities, ""])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add priority
          </Button>
        </div>

        {/* Focus fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="weekly-health-focus">Health focus</Label>
            <Input
              id="weekly-health-focus"
              value={healthFocus}
              onChange={e => setHealthFocus(e.target.value)}
              placeholder="e.g. Morning walks, 8h sleep..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weekly-business-focus">Business focus</Label>
            <Input
              id="weekly-business-focus"
              value={businessFocus}
              onChange={e => setBusinessFocus(e.target.value)}
              placeholder="e.g. Finish the onboarding flow..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weekly-creative-focus">Creative / build focus</Label>
            <Input
              id="weekly-creative-focus"
              value={creativeFocus}
              onChange={e => setCreativeFocus(e.target.value)}
              placeholder="e.g. Design the landing page..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weekly-notes">Notes</Label>
            <Textarea
              id="weekly-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything else to keep in mind this week..."
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>
        </div>

        <Button className="w-full rounded-xl" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save weekly plan
        </Button>
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
              <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-what-moved-forward">What moved forward?</Label>
                  <Textarea
                    id="weekly-what-moved-forward"
                    value={whatMovedForward}
                    onChange={e => setWhatMovedForward(e.target.value)}
                    placeholder="What made real progress this week?"
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-what-got-stuck">What got stuck?</Label>
                  <Textarea
                    id="weekly-what-got-stuck"
                    value={whatGotStuck}
                    onChange={e => setWhatGotStuck(e.target.value)}
                    placeholder="What felt blocked or stalled?"
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-what-continues">What continues next week?</Label>
                  <Textarea
                    id="weekly-what-continues"
                    value={whatContinues}
                    onChange={e => setWhatContinues(e.target.value)}
                    placeholder="What carries forward?"
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-what-to-deprioritize">What to deprioritize</Label>
                  <Textarea
                    id="weekly-what-to-deprioritize"
                    value={whatToDeprioritize}
                    onChange={e => setWhatToDeprioritize(e.target.value)}
                    placeholder="What's OK to let go of or slow down?"
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weekly-next-week-focus">Next week's key focus</Label>
                  <Textarea
                    id="weekly-next-week-focus"
                    value={nextWeekFocus}
                    onChange={e => setNextWeekFocus(e.target.value)}
                    placeholder="One sentence: what's the north star next week?"
                    className="rounded-xl resize-none"
                    rows={2}
                  />
                </div>
                <Button className="w-full rounded-xl" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save reflection
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
