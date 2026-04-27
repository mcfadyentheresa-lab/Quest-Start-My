import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useGetDashboardSummary,
  useListTasks,
  useGetReentryTask,
  useUpdateTask,
  useCreateTask,
  useListPillars,
  useGetTaskSuggestions,
  useUpdateWeeklyPlanPriorities,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
  getGetTaskSuggestionsQueryKey,
  getListWeeklyPlansQueryKey,
  type PillarWithPriorityPriority,
} from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { ProgressSummary } from "@/components/progress-summary";
import { PriorityBadge, PriorityLegend } from "@/components/priority-badge";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { FocusTimerWidget } from "@/components/focus-timer-widget";
import { FocusNudgeDialog } from "@/components/focus-nudge-dialog";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Sprout, ArrowRight, CheckCircle2, ExternalLink, CalendarDays, Timer, Lightbulb, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";

const PRIORITY_LEVELS: PillarWithPriorityPriority[] = ["P1", "P2", "P3", "P4"];

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

const FOCUS_DURATIONS = [5, 10, 15, 25] as const;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const search = useSearch();
  const [, navigate] = useLocation();
  const viewDate = new URLSearchParams(search).get("date") ?? today;
  const isViewingHistory = viewDate !== today;

  const setDateParam = (date: string) => navigate(`/?date=${date}`);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const weekOf = getWeekStart();
  const updatePriorities = useUpdateWeeklyPlanPriorities();

  const timer = useFocusTimer();
  const [selectedFocusDuration, setSelectedFocusDuration] = useState<number>(() => timer.defaultDuration);

  const [dismissedMilestoneIds, setDismissedMilestoneIds] = useState<Set<number>>(new Set());
  const [addingSuggestionId, setAddingSuggestionId] = useState<number | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [editedTitles, setEditedTitles] = useState<Map<number, string>>(new Map());

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: tasks, isLoading: tasksLoading } = useListTasks(
    { date: viewDate },
    { query: { queryKey: getListTasksQueryKey({ date: viewDate }) } }
  );
  const { data: reentry } = useGetReentryTask({
    query: { queryKey: getGetReentryTaskQueryKey() }
  });
  const { data: pillars } = useListPillars();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const todayTaskCount = !isViewingHistory ? (tasks?.length ?? 0) : 3;
  const { data: rawSuggestions } = useGetTaskSuggestions(
    { date: today },
    { query: { enabled: !isViewingHistory && todayTaskCount < 3, queryKey: getGetTaskSuggestionsQueryKey({ date: today }) } }
  );
  const visibleSuggestions = (rawSuggestions ?? []).filter(s => !dismissedMilestoneIds.has(s.milestoneId));

  const handleAddSuggestion = (suggestion: typeof visibleSuggestions[number]) => {
    setAddingSuggestionId(suggestion.milestoneId);
    setEditingTitleId(null);
    const title = editedTitles.get(suggestion.milestoneId)?.trim() || suggestion.title;
    createTask.mutate(
      {
        data: {
          title,
          category: suggestion.pillarCategory ?? "business",
          date: today,
          pillarId: suggestion.pillarId,
          milestoneId: suggestion.milestoneId,
        },
      },
      {
        onSuccess: () => {
          setDismissedMilestoneIds(prev => new Set([...prev, suggestion.milestoneId]));
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTaskSuggestionsQueryKey({ date: today }) });
          toast({ title: "Task added", description: title });
        },
        onSettled: () => setAddingSuggestionId(null),
      }
    );
  };

  const handleAddAllSuggestions = async () => {
    let added = 0;
    let failed = 0;
    for (const suggestion of visibleSuggestions) {
      const title = editedTitles.get(suggestion.milestoneId)?.trim() || suggestion.title;
      await new Promise<void>((resolve) => {
        createTask.mutate(
          {
            data: {
              title,
              category: suggestion.pillarCategory ?? "business",
              date: today,
              pillarId: suggestion.pillarId,
              milestoneId: suggestion.milestoneId,
            },
          },
          {
            onSuccess: () => {
              added++;
              setDismissedMilestoneIds(prev => new Set([...prev, suggestion.milestoneId]));
            },
            onError: () => { failed++; },
            onSettled: () => resolve(),
          }
        );
      });
    }
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskSuggestionsQueryKey({ date: today }) });
    if (failed === 0) {
      toast({ title: "Tasks added", description: `${added} task${added !== 1 ? "s" : ""} added for today` });
    } else {
      toast({
        title: added > 0 ? "Some tasks added" : "Could not add tasks",
        description: added > 0
          ? `${added} added, ${failed} failed — try again for the rest`
          : "Something went wrong. Please try adding tasks individually.",
        variant: "destructive",
      });
    }
  };

  const pendingTasks = tasks?.filter(t => t.status === "pending") ?? [];
  const completedTasks = tasks?.filter(t => t.status !== "pending") ?? [];

  // Group tasks by pillar. Returns ordered groups: pillar groups first (sorted by pillar name), then unassigned.
  function groupByPillar(taskList: typeof pendingTasks) {
    if (!pillars || pillars.length === 0) return null;
    const pillarIds = new Set(pillars.map(p => p.id));
    const groups = new Map<number | null, typeof pendingTasks>();
    for (const task of taskList) {
      // Treat tasks whose pillarId is missing from the current pillar list as Unassigned
      const key = (task.pillarId && pillarIds.has(task.pillarId)) ? task.pillarId : null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    // Build ordered list: pillar groups in pillar order, then unassigned
    const result: { pillarId: number | null; label: string; color?: string | null; tasks: typeof pendingTasks }[] = [];
    for (const pillar of pillars) {
      if (groups.has(pillar.id)) {
        result.push({ pillarId: pillar.id, label: pillar.name, color: pillar.color, tasks: groups.get(pillar.id)! });
      }
    }
    if (groups.has(null)) {
      result.push({ pillarId: null, label: "Unassigned", color: null, tasks: groups.get(null)! });
    }
    return result.length > 0 ? result : null;
  }

  const pendingGroups = groupByPillar(pendingTasks);
  const completedGroups = groupByPillar(completedTasks);

  const handleJumpToTask = () => {
    if (!reentry?.task) return;
    setDateParam(reentry.task.date);
    setTimeout(() => {
      document.getElementById("tasks-section")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  const pendingTasksToday = tasks?.filter(t => t.status === "pending" && t.date === today) ?? [];

  const focusedTask = pendingTasksToday.find(t => t.id === timer.taskId) ?? pendingTasksToday[0] ?? null;
  const nextPendingTask = focusedTask
    ? pendingTasksToday.find(t => t.id !== focusedTask.id)
    : null;

  const handleStartFocusBlock = (task: typeof pendingTasksToday[0]) => {
    timer.startTimer({ taskTitle: task.title, taskId: task.id, durationMins: selectedFocusDuration });
    timer.unlockAudio();
  };

  const handleNudgeStartNext = () => {
    const currentId = timer.taskId;
    timer.dismissNudge();
    if (currentId !== null) {
      const currentTask = tasks?.find(t => t.id === currentId);
      if (currentTask && currentTask.status === "pending") {
        updateTask.mutate(
          { id: currentId, data: { status: "done" } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
              if (nextPendingTask) {
                toast({ title: "Starting next task", description: nextPendingTask.title });
              } else {
                toast({ title: "Task marked done", description: "All clear — no more tasks!" });
              }
            },
          }
        );
      }
    }
  };

  const handleMarkReentryDone = () => {
    if (!reentry?.task) return;
    updateTask.mutate(
      { id: reentry.task.id, data: { status: "done" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Marked as done" });
        },
      }
    );
  };

  if (summaryLoading && tasksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  // Build a quick pillar map for task chips
  const pillarMap = new Map(pillars?.map(p => [p.id, p]) ?? []);

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-4"
      >
        <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          {summary?.todayDate ? formatDate(summary.todayDate) : formatDate(today)}
        </p>
        <h1 className="font-serif text-3xl font-medium text-foreground mt-1">
          {getGreeting()}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 italic">Let's make today count.</p>
      </motion.section>

      {/* Priority legend */}
      <section>
        <PriorityLegend />
      </section>

      {/* Weekly plan nudge - show when no plan or plan lacks businessFocus/creativeFocus */}
      {!summaryLoading && summary && (!summary.weeklyPlan || (!summary.weeklyPlan.businessFocus && !summary.weeklyPlan.creativeFocus)) && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-4 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Start your week with intention
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl gap-1.5 text-primary text-xs font-semibold shrink-0"
            onClick={() => navigate("/weekly")}
          >
            Plan now
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </motion.section>
      )}

      {/* Active pillars */}
      {summary?.activePillars && summary.activePillars.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-serif text-base font-medium text-foreground mb-3">Active this week</h2>
          <div className="flex flex-wrap gap-2">
            {summary.activePillars.map(pillar => (
              <div
                key={pillar.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-card-border text-sm"
              >
                {pillar.color && (
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: pillar.color }}
                  />
                )}
                <span className="font-medium text-foreground">{pillar.name}</span>
                <PriorityBadge priority={pillar.priority} />
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Weekly focus */}
      {summary?.weeklyPlan && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card border border-card-border p-5"
        >
          <h2 className="font-serif text-base font-medium text-foreground mb-3">This week's focus</h2>
          {summary.weeklyPlan.priorities.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {summary.weeklyPlan.priorities.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-primary font-bold mt-0.5">·</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {(summary.weeklyPlan.healthFocus || summary.weeklyPlan.businessFocus || summary.weeklyPlan.creativeFocus) && (
            <div className="pt-2 border-t border-border space-y-1.5">
              {summary.weeklyPlan.healthFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Health</p>
                  <p className="text-sm text-foreground/80">{summary.weeklyPlan.healthFocus}</p>
                </div>
              )}
              {summary.weeklyPlan.businessFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Business</p>
                  <p className="text-sm text-foreground/80">{summary.weeklyPlan.businessFocus}</p>
                </div>
              )}
              {summary.weeklyPlan.creativeFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Creative</p>
                  <p className="text-sm text-foreground/80">{summary.weeklyPlan.creativeFocus}</p>
                </div>
              )}
            </div>
          )}
        </motion.section>
      )}

      {/* Per-pillar priorities for this week (sourced from weekly_plans.pillarPriorities) */}
      {!isViewingHistory && summary?.activePillars && summary.activePillars.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17 }}
          className="rounded-2xl bg-card border border-card-border p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base font-medium text-foreground">Today's priorities</h2>
            <span className="text-xs text-muted-foreground">Week of {weekOf}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Set this week's priority on each active pillar. P1 = must move now · P4 = parked.
          </p>
          <div className="space-y-2">
            {summary.activePillars.map(pillar => {
              const current = (pillar.priority ?? "P4") as PillarWithPriorityPriority;
              const currentMap = (summary.weeklyPlan?.pillarPriorities ?? {}) as Record<string, PillarWithPriorityPriority>;
              const handleChange = (next: PillarWithPriorityPriority) => {
                if (next === current) return;
                const merged: Record<string, PillarWithPriorityPriority> = { ...currentMap };
                merged[String(pillar.id)] = next;
                updatePriorities.mutate(
                  { weekKey: weekOf, data: { pillarPriorities: merged } },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                      queryClient.invalidateQueries({ queryKey: getListWeeklyPlansQueryKey({ weekOf }) });
                    },
                    onError: () => toast({ title: "Couldn't update priority", variant: "destructive" }),
                  }
                );
              };
              return (
                <div key={pillar.id} className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {pillar.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: pillar.color }}
                      />
                    )}
                    <span className="text-sm font-medium text-foreground truncate">{pillar.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {PRIORITY_LEVELS.map(level => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleChange(level)}
                        disabled={updatePriorities.isPending}
                        aria-pressed={current === level}
                        className={`text-xs font-bold px-2 py-1 rounded-full border transition-colors ${
                          current === level
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Daily task suggestions from milestones */}
      {!isViewingHistory && visibleSuggestions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.19 }}
          className="rounded-2xl bg-card border border-card-border p-5"
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <h2 className="font-serif text-base font-medium text-foreground">Suggested for today</h2>
            </div>
            {visibleSuggestions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl text-xs gap-1.5 shrink-0"
                onClick={handleAddAllSuggestions}
                disabled={createTask.isPending}
              >
                <Plus className="h-3 w-3" />
                Add all
              </Button>
            )}
          </div>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {visibleSuggestions.map(suggestion => (
                <motion.div
                  key={suggestion.milestoneId}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {suggestion.pillarColor && (
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: suggestion.pillarColor }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{suggestion.pillarName}</p>
                        <p className="text-xs text-primary/70 truncate">↑ {suggestion.milestoneTitle}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDismissedMilestoneIds(prev => new Set([...prev, suggestion.milestoneId]))}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-0.5"
                      aria-label={`Dismiss suggestion: ${suggestion.title}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {editingTitleId === suggestion.milestoneId ? (
                    <input
                      autoFocus
                      value={editedTitles.get(suggestion.milestoneId) ?? suggestion.title}
                      onChange={e =>
                        setEditedTitles(prev => new Map(prev).set(suggestion.milestoneId, e.target.value))
                      }
                      onBlur={() => setEditingTitleId(null)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === "Escape") setEditingTitleId(null);
                      }}
                      className="w-full text-sm font-medium text-foreground leading-snug mb-3 bg-background border border-primary/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    <p
                      className="text-sm font-medium text-foreground leading-snug mb-3 cursor-text hover:text-primary transition-colors"
                      title="Click to edit title"
                      onClick={() => {
                        if (!editedTitles.has(suggestion.milestoneId)) {
                          setEditedTitles(prev => new Map(prev).set(suggestion.milestoneId, suggestion.title));
                        }
                        setEditingTitleId(suggestion.milestoneId);
                      }}
                    >
                      {editedTitles.get(suggestion.milestoneId) ?? suggestion.title}
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="rounded-xl text-xs w-full gap-1.5"
                    onClick={() => handleAddSuggestion(suggestion)}
                    disabled={addingSuggestionId === suggestion.milestoneId || createTask.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add this task
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Re-entry panel */}
      {reentry && reentry.type !== "none" && reentry.task && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className={`rounded-2xl border-2 p-5 ${
            reentry.type === "unfinished"
              ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10"
              : "border-border bg-muted/30"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {reentry.type === "unfinished" ? "Pick up where you left off" : "Your last completed task"}
          </p>

          {/* Milestone context */}
          {reentry.task.milestoneTitle && (
            <p className="text-xs text-primary/80 font-medium mb-1">
              ↑ {reentry.task.milestoneTitle}
            </p>
          )}

          <p className="font-serif text-base font-medium text-foreground leading-snug">
            {reentry.task.title}
          </p>
          {reentry.task.date !== today && (
            <p className="text-xs text-muted-foreground mt-0.5">From {formatShortDate(reentry.task.date)}</p>
          )}

          {/* Why it matters */}
          {reentry.task.whyItMatters && (
            <p className="text-xs text-foreground/60 mt-1.5 italic leading-relaxed">{reentry.task.whyItMatters}</p>
          )}

          {/* Blocker reason */}
          {reentry.task.blockerReason && (
            <div className="mt-2 rounded-lg bg-rose-100/70 dark:bg-rose-900/20 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-0.5">Was blocked</p>
              <p className="text-xs text-foreground/70">{reentry.task.blockerReason}</p>
            </div>
          )}

          {/* Suggested next step */}
          {reentry.task.suggestedNextStep && (
            <div className="mt-2 flex items-start gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">{reentry.task.suggestedNextStep}</p>
            </div>
          )}

          {/* Guidance */}
          {reentry.guidance && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 italic">{reentry.guidance}</p>
          )}

          {reentry.type === "unfinished" && (
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={handleJumpToTask}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Jump to task
              </Button>
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={handleMarkReentryDone}
                disabled={updateTask.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark done
              </Button>
            </div>
          )}
        </motion.section>
      )}

      {/* Progress summary */}
      {tasks && tasks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-serif text-base font-medium text-foreground mb-3">Today's progress</h2>
          <ProgressSummary
            doneCount={summary?.doneCount ?? 0}
            pushedCount={summary?.pushedCount ?? 0}
            passedCount={summary?.passedCount ?? 0}
            blockedCount={summary?.blockedCount ?? 0}
            totalCount={tasks.length}
          />
        </motion.section>
      )}

      {/* Historical date banner */}
      {isViewingHistory && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-700 px-4 py-3 flex items-center justify-between"
        >
          <p className="text-sm text-foreground/80">
            Viewing tasks from <strong>{formatDate(viewDate)}</strong>
          </p>
          <Button size="sm" variant="ghost" className="text-xs rounded-xl" onClick={() => navigate("/")}>
            Back to today
          </Button>
        </motion.div>
      )}

      {/* Focus nudge dialog — rendered at page level so it overlays everything */}
      <FocusNudgeDialog
        open={timer.isNudging}
        taskTitle={timer.taskTitle}
        nextTaskTitle={nextPendingTask?.title ?? null}
        soundEnabled={timer.soundEnabled}
        onStartNext={handleNudgeStartNext}
        onSnooze5={() => timer.snooze(5)}
        onSnooze15={() => timer.snooze(15)}
        onNeedMoreTime={() => timer.needMoreTime(15)}
        onDismiss={timer.dismissNudge}
        onToggleSound={() => timer.setSoundEnabled(!timer.soundEnabled)}
      />

      {/* Tasks section */}
      <section id="tasks-section">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base font-medium text-foreground">
            {isViewingHistory ? `Tasks from ${formatShortDate(viewDate)}` : "Today's tasks"}
          </h2>
          {!isViewingHistory && (
            <AddTaskDialog date={viewDate}>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add task
              </Button>
            </AddTaskDialog>
          )}
        </div>

        {/* Focus block controls */}
        {!isViewingHistory && !timer.isRunning && !timer.isNudging && pendingTasksToday.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-2xl border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-900/10 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">Focus block</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">on: {focusedTask?.title ?? "first task"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {FOCUS_DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedFocusDuration(d)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                      selectedFocusDuration === d
                        ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300"
                        : "border-border text-muted-foreground hover:border-violet-300 hover:text-violet-600"
                    }`}
                    aria-pressed={selectedFocusDuration === d}
                    aria-label={`Focus for ${d} minutes`}
                  >
                    {d}m
                  </button>
                ))}
                <Button
                  size="sm"
                  className="rounded-xl bg-violet-600 text-white hover:bg-violet-700 ml-1 text-xs font-medium px-3"
                  onClick={() => focusedTask && handleStartFocusBlock(focusedTask)}
                  disabled={!focusedTask}
                >
                  Start
                </Button>
              </div>
            </div>
            {focusedTask && (
              <p className="text-xs text-muted-foreground mt-1.5 sm:hidden truncate">
                on: {focusedTask.title}
              </p>
            )}
          </motion.div>
        )}

        {/* Active timer widget */}
        {!isViewingHistory && (timer.isRunning || (!timer.isNudging && timer.remaining > 0)) && (
          <div className="mb-3">
            <FocusTimerWidget
              isRunning={timer.isRunning}
              isVisible={timer.isRunning || timer.remaining > 0}
              remaining={timer.remaining}
              totalSeconds={timer.totalSeconds}
              taskTitle={timer.taskTitle}
              soundEnabled={timer.soundEnabled}
              audioUnlocked={timer.audioUnlocked}
              onPause={timer.pauseTimer}
              onResume={timer.resumeTimer}
              onCancel={timer.cancelTimer}
              onToggleSound={() => timer.setSoundEnabled(!timer.soundEnabled)}
              onUnlockAudio={timer.unlockAudio}
            />
          </div>
        )}

        {tasksLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-card border border-dashed border-border">
            <Sprout className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">
              {isViewingHistory ? "No tasks found for this date" : "No tasks yet for today"}
            </p>
            {!isViewingHistory && (
              <>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Add up to 3 tasks to get started</p>
                <AddTaskDialog date={viewDate} />
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {pendingGroups ? (
              pendingGroups.map((group) => (
                <div key={group.pillarId ?? "unassigned"} className="space-y-2">
                  {(pendingGroups.length > 1 || group.pillarId === null) && (
                    <div className="flex items-center gap-2 px-1 pt-1">
                      {group.color && (
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      )}
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                    </div>
                  )}
                  <AnimatePresence mode="popLayout">
                    {group.tasks.map(task => (
                      <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
                    ))}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {pendingTasks.map(task => (
                  <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
                ))}
              </AnimatePresence>
            )}
            {completedTasks.length > 0 && (
              <>
                {pendingTasks.length > 0 && <div className="border-t border-dashed border-border my-2" />}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Completed</p>
                {completedGroups ? (
                  completedGroups.map((group) => (
                    <div key={group.pillarId ?? "unassigned"} className="space-y-2">
                      {(completedGroups.length > 1 || group.pillarId === null) && (
                        <div className="flex items-center gap-2 px-1 pt-1">
                          {group.color && (
                            <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                          )}
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {group.label}
                          </p>
                        </div>
                      )}
                      <AnimatePresence mode="popLayout">
                        {group.tasks.map(task => (
                          <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
                        ))}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  <AnimatePresence mode="popLayout">
                    {completedTasks.map(task => (
                      <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
                    ))}
                  </AnimatePresence>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
