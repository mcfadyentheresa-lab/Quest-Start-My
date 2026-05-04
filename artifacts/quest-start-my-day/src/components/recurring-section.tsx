/**
 * RecurringSection — per-area panel for recurring task templates.
 *
 * Mounts on /areas/:id between Loose tasks and Recently closed.
 * Collapsed by default (mirrors GoalCard pattern). When expanded:
 *   - lists this area's recurring templates with frequency + cadence detail
 *   - shows pause/resume + delete controls per row
 *   - has a small inline "Add recurring" form (title + frequency, with
 *     conditional weekdays-checkboxes for weekly or day-of-month input
 *     for monthly).
 *
 * Voice: chief-of-staff. Decisive, neutral pronouns. No emojis.
 *
 * Why client-side filter (not a server `?areaId=` param): the API today
 * lists all templates without filter; templates per user are few (single
 * digits in practice), and filtering in the client keeps the surface area
 * of PR 2 small. If this list grows, add a server filter later.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pause,
  Play,
  Trash2,
  Repeat,
} from "lucide-react";
import {
  useListRecurringTasks,
  useCreateRecurringTask,
  useUpdateRecurringTask,
  useDeleteRecurringTask,
  getListRecurringTasksQueryKey,
  getListTasksQueryKey,
  getListAreaTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  type RecurringTask,
  type CreateRecurringTaskBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface RecurringSectionProps {
  areaId: number;
}

type Frequency = "daily" | "weekly" | "monthly";

const WEEKDAY_LABELS: ReadonlyArray<{ value: number; short: string }> = [
  { value: 0, short: "Sun" },
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Human-readable cadence summary for a template row. */
function cadenceLabel(t: RecurringTask): string {
  if (t.frequency === "daily") return "Every day";
  if (t.frequency === "weekly") {
    const wd = (t.weekdays ?? []) as number[];
    if (wd.length === 0) return "Weekly";
    if (wd.length === 7) return "Every day";
    const labels = wd
      .slice()
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS[d]?.short ?? String(d));
    return labels.join(", ");
  }
  if (t.frequency === "monthly") {
    return t.dayOfMonth ? `Day ${t.dayOfMonth} of each month` : "Monthly";
  }
  return t.frequency;
}

export function RecurringSection({ areaId }: RecurringSectionProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const listQuery = useListRecurringTasks();
  const allTemplates = listQuery.data ?? [];
  // Client-side filter — API has no `?areaId=` param yet.
  const templates = allTemplates.filter((t) => t.areaId === areaId);

  const createMutation = useCreateRecurringTask();
  const updateMutation = useUpdateRecurringTask();
  const deleteMutation = useDeleteRecurringTask();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListRecurringTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
    queryClient.invalidateQueries({ queryKey: getListAreaTasksQueryKey(areaId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  // Form state
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<string>("1");

  const resetForm = () => {
    setTitle("");
    setFrequency("daily");
    setWeekdays([]);
    setDayOfMonth("1");
    setCreating(false);
  };

  const toggleWeekday = (d: number) => {
    setWeekdays((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b),
    );
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast({ title: "Title required.", variant: "destructive" });
      return;
    }
    if (frequency === "weekly" && weekdays.length === 0) {
      toast({ title: "Pick at least one weekday.", variant: "destructive" });
      return;
    }
    if (frequency === "monthly") {
      const n = Number(dayOfMonth);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        toast({ title: "Day of month must be 1–31.", variant: "destructive" });
        return;
      }
    }

    const body: CreateRecurringTaskBody = {
      title: trimmed,
      frequency,
      areaId,
      weekdays: frequency === "weekly" ? weekdays : null,
      dayOfMonth: frequency === "monthly" ? Number(dayOfMonth) : null,
    };

    try {
      await createMutation.mutateAsync({ data: body });
      resetForm();
      invalidate();
      toast({ title: "Recurring task added." });
    } catch (err) {
      toast({
        title: "Couldn't save that.",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const togglePause = async (t: RecurringTask) => {
    const isPaused = !!t.pausedAt;
    try {
      await updateMutation.mutateAsync({
        id: t.id,
        data: { pausedAt: isPaused ? null : new Date().toISOString() },
      });
      invalidate();
      toast({ title: isPaused ? "Resumed." : "Paused." });
    } catch (err) {
      toast({
        title: "Couldn't update.",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const remove = async (t: RecurringTask) => {
    if (!window.confirm(`Delete recurring task "${t.title}"? Existing instances on Today won't be removed.`)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id: t.id });
      invalidate();
      toast({ title: "Deleted." });
    } catch (err) {
      toast({
        title: "Couldn't delete.",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <section aria-labelledby="recurring-heading" className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
        aria-expanded={open}
        data-testid="recurring-section-toggle"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
        <h2
          id="recurring-heading"
          className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide"
        >
          Recurring{templates.length > 0 ? ` (${templates.length})` : ""}
        </h2>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="recurring-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Items here repeat on their own schedule. They show up on Today when they're due.
              </p>

              {listQuery.isLoading ? (
                <Skeleton className="h-16 w-full rounded-2xl" />
              ) : templates.length === 0 ? (
                <div className="rounded-2xl bg-card border border-card-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nothing repeating yet. Add one below.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => {
                    const paused = !!t.pausedAt;
                    return (
                      <li
                        key={t.id}
                        data-testid={`recurring-row-${t.id}`}
                        className="rounded-2xl bg-card border border-card-border p-3 flex items-start gap-3"
                      >
                        <Repeat
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${paused ? "text-muted-foreground" : "text-foreground/70"}`}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${paused ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {cadenceLabel(t)}
                            {paused ? " · Paused" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePause(t)}
                            disabled={updateMutation.isPending}
                            aria-label={paused ? "Resume" : "Pause"}
                            data-testid={`recurring-toggle-pause-${t.id}`}
                          >
                            {paused ? (
                              <Play className="h-4 w-4" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(t)}
                            disabled={deleteMutation.isPending}
                            aria-label="Delete"
                            data-testid={`recurring-delete-${t.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {creating ? (
                <div
                  className="rounded-2xl bg-card border border-card-border p-3 space-y-3"
                  data-testid="recurring-create-form"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="recurring-title">Title</Label>
                    <Input
                      id="recurring-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Post to Instagram"
                      className="rounded-xl"
                      data-testid="recurring-title-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Repeat</Label>
                    <Select
                      value={frequency}
                      onValueChange={(v) => setFrequency(v as Frequency)}
                    >
                      <SelectTrigger className="rounded-xl" data-testid="recurring-frequency-trigger">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {frequency === "weekly" && (
                    <div className="space-y-1.5">
                      <Label>On</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_LABELS.map((d) => {
                          const on = weekdays.includes(d.value);
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleWeekday(d.value)}
                              data-testid={`recurring-weekday-${d.value}`}
                              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                                on
                                  ? "bg-foreground text-background border-foreground"
                                  : "bg-card text-foreground border-card-border hover:border-foreground/40"
                              }`}
                            >
                              {d.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {frequency === "monthly" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring-dom">Day of month</Label>
                      <Input
                        id="recurring-dom"
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(e.target.value)}
                        className="rounded-xl w-24"
                        data-testid="recurring-dom-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        Days past the last of the month are clamped (e.g. 31 → 30 in April).
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={submit}
                      disabled={createMutation.isPending}
                      data-testid="recurring-submit"
                    >
                      {createMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={resetForm}
                      disabled={createMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(true)}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="recurring-add-button"
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add recurring
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
