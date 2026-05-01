import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useGetDashboardSummary,
  useListTasks,
  useUpdateTask,
  useCreateTask,
  useListAreas,
  useListDailyPlans,
  useGetBriefingToday,
  useReshuffleBriefing,
  useApproveBriefing,
  useGetDashboardRecap,
  useRegenerateRecap,
  useSaveRecapReflection,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getListDailyPlansQueryKey,
  getBriefingTodayQueryKey,
  getDashboardRecapQueryKey,
} from "@workspace/api-client-react";
import type { BriefingItem } from "@workspace/api-client-react";
import { isAfterLocalHour } from "@/lib/timezone";
import { TaskCard } from "@/components/task-card";
import { ProgressSummary } from "@/components/progress-summary";
import { PriorityBadge } from "@/components/priority-badge";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { FocusTimerWidget } from "@/components/focus-timer-widget";
import { FocusNudgeDialog } from "@/components/focus-nudge-dialog";
import { useFocusTimer, clampDuration, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from "@/hooks/use-focus-timer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/data-load-error";
import { Plus, Sprout, ArrowRight, CalendarDays, Timer, ChevronDown, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation, Link } from "wouter";
import {
  BriefingCard,
  BriefingCardSkeleton,
  BriefingCardError,
} from "@/components/briefing-card";
import {
  EveningRecapCard,
  EveningRecapCardSkeleton,
  EveningRecapCardError,
} from "@/components/evening-recap-card";
import { OnboardingWizard, isOnboardingComplete, markOnboardingComplete } from "@/components/onboarding-wizard";
import { OnboardingChecklist, markBriefingViewed } from "@/components/onboarding-checklist";

const FOCUS_DURATIONS = [5, 10, 15, 25] as const;

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateMono(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return `${weekday} · ${month} ${day}`;
}

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const search = useSearch();
  const [, navigate] = useLocation();
  const viewDate = new URLSearchParams(search).get("date") ?? today;
  const isViewingHistory = viewDate !== today;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dailyPlans } = useListDailyPlans(
    { date: today },
    { query: { queryKey: getListDailyPlansQueryKey({ date: today }), enabled: !isViewingHistory } },
  );
  // Keep daily-plan side effect even though we no longer render the priorities form prominently.
  void dailyPlans;

  const timer = useFocusTimer();
  const [selectedFocusDuration, setSelectedFocusDuration] = useState<number>(() => timer.defaultDuration);
  const [customDurationInput, setCustomDurationInput] = useState<string>("");
  const [showWizard, setShowWizard] = useState<boolean>(() => !isOnboardingComplete());
  const [emptyAddTaskOpen, setEmptyAddTaskOpen] = useState<boolean>(false);
  // Phase 3: "This week" focus panel collapses by default. The dashboard
  // is mostly today — weekly context is one tap away when the user wants
  // to zoom out. Persisted to localStorage so the user's last choice
  // sticks across refreshes.
  const [thisWeekOpen, setThisWeekOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dashboard.thisWeekOpen") === "1";
  });
  const toggleThisWeek = () => {
    setThisWeekOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("dashboard.thisWeekOpen", next ? "1" : "0");
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };

  const isPresetDuration = (FOCUS_DURATIONS as readonly number[]).includes(selectedFocusDuration);

  const handleCustomDurationChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setCustomDurationInput(cleaned);
    if (cleaned === "") return;
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed >= MIN_DURATION_MINUTES && parsed <= MAX_DURATION_MINUTES) {
      setSelectedFocusDuration(parsed);
    }
  };

  const handleCustomDurationCommit = () => {
    if (customDurationInput === "") return;
    const parsed = parseInt(customDurationInput, 10);
    if (isNaN(parsed)) {
      setCustomDurationInput("");
      return;
    }
    const safe = clampDuration(parsed);
    setSelectedFocusDuration(safe);
    setCustomDurationInput(String(safe));
  };

  const summaryQuery = useGetDashboardSummary();
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = summaryQuery;
  const tasksQuery = useListTasks(
    { date: viewDate },
    { query: { queryKey: getListTasksQueryKey({ date: viewDate }) } },
  );
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = tasksQuery;
  const { data: areas } = useListAreas();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const showEveningRecap = !isViewingHistory && isAfterLocalHour(new Date(), 17);
  const briefingEnabled = !isViewingHistory && !showEveningRecap;
  const recapEnabled = !isViewingHistory && showEveningRecap;

  const briefingQuery = useGetBriefingToday({
    query: {
      queryKey: getBriefingTodayQueryKey(),
      enabled: briefingEnabled,
      staleTime: 60 * 1000,
    },
  });

  const recapQuery = useGetDashboardRecap({
    query: {
      queryKey: getDashboardRecapQueryKey(),
      enabled: recapEnabled,
      staleTime: 60 * 1000,
    },
  });

  const regenerateRecapMutation = useRegenerateRecap({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getDashboardRecapQueryKey(), data);
        toast({ title: "Recap refreshed" });
      },
      onError: () => {
        toast({ title: "Couldn't refresh recap", variant: "destructive" });
      },
    },
  });

  const saveReflectionMutation = useSaveRecapReflection({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getDashboardRecapQueryKey(), data);
      },
      onError: () => {
        toast({ title: "Couldn't save reflection", variant: "destructive" });
      },
    },
  });

  const reshuffleMutation = useReshuffleBriefing({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getBriefingTodayQueryKey(), data);
        toast({ title: "New plan generated" });
      },
      onError: () => {
        toast({ title: "Couldn't reshuffle", variant: "destructive" });
      },
    },
  });

  const approveMutation = useApproveBriefing({
    mutation: {
      onSuccess: (data) => {
        if (data.briefing) {
          queryClient.setQueryData(getBriefingTodayQueryKey(), data.briefing);
        }
        toast({ title: "Plan locked in" });
      },
      onError: () => {
        toast({ title: "Couldn't approve", variant: "destructive" });
      },
    },
  });

  const pendingTasks = tasks?.filter((t) => t.status === "pending") ?? [];
  const completedTasks = tasks?.filter((t) => t.status !== "pending") ?? [];

  function groupByArea(taskList: typeof pendingTasks) {
    if (!areas || areas.length === 0) return null;
    const areaIds = new Set(areas.map((a) => a.id));
    const groups = new Map<number | null, typeof pendingTasks>();
    for (const task of taskList) {
      const key = task.areaId && areaIds.has(task.areaId) ? task.areaId : null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
    const result: { areaId: number | null; label: string; color?: string | null; tasks: typeof pendingTasks }[] = [];
    for (const area of areas) {
      if (groups.has(area.id)) {
        result.push({ areaId: area.id, label: area.name, color: area.color, tasks: groups.get(area.id)! });
      }
    }
    if (groups.has(null)) {
      result.push({ areaId: null, label: "Unassigned", color: null, tasks: groups.get(null)! });
    }
    return result.length > 0 ? result : null;
  }

  const pendingGroups = groupByArea(pendingTasks);
  const completedGroups = groupByArea(completedTasks);

  const pendingTasksToday = tasks?.filter((t) => t.status === "pending" && t.date === today) ?? [];
  const focusedTask = pendingTasksToday.find((t) => t.id === timer.taskId) ?? pendingTasksToday[0] ?? null;
  const nextPendingTask = focusedTask
    ? pendingTasksToday.find((t) => t.id !== focusedTask.id)
    : null;

  const handleStartFocusBlock = (task: { id: number; title: string }) => {
    timer.startTimer({ taskTitle: task.title, taskId: task.id, durationMins: selectedFocusDuration });
    timer.unlockAudio();
  };

  const handleNudgeStartNext = () => {
    const currentId = timer.taskId;
    timer.dismissNudge();
    if (currentId !== null) {
      const currentTask = tasks?.find((t) => t.id === currentId);
      if (currentTask && currentTask.status === "pending") {
        updateTask.mutate(
          { id: currentId, data: { status: "done" } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
              if (nextPendingTask) {
                toast({ title: "Starting next task", description: nextPendingTask.title });
              } else {
                toast({ title: "Task marked done", description: "All clear — no more tasks!" });
              }
            },
          },
        );
      }
    }
  };

  const handleBriefingStart = (item: BriefingItem) => {
    if (typeof item.taskId === "number") {
      handleStartFocusBlock({ id: item.taskId, title: item.title });
      return;
    }
    if (typeof item.taskId === "string" && /^\d+$/.test(item.taskId)) {
      handleStartFocusBlock({ id: Number(item.taskId), title: item.title });
      return;
    }
    const area = areas?.find((a) => a.name === item.pillarName) ?? null;
    const category = area?.category ?? "business";
    createTask.mutate(
      {
        data: {
          title: item.title,
          category,
          date: today,
          areaId: area?.id ?? null,
          suggestedNextStep: item.suggestedNextStep,
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          handleStartFocusBlock({ id: created.id, title: created.title });
        },
      },
    );
  };

  const handleBriefingMarkDone = (item: BriefingItem) => {
    if (typeof item.taskId !== "number") {
      toast({ title: "This is a suggestion — add it to today first." });
      return;
    }
    updateTask.mutate(
      { id: item.taskId, data: { status: "done" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getBriefingTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getDashboardRecapQueryKey() });
          toast({ title: "Marked done", description: item.title });
        },
      },
    );
  };

  const handleBriefingPush = (item: BriefingItem) => {
    if (typeof item.taskId !== "number") return;
    updateTask.mutate(
      { id: item.taskId, data: { status: "pushed" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getBriefingTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getDashboardRecapQueryKey() });
          toast({ title: "Pushed to tomorrow", description: item.title });
        },
      },
    );
  };

  const handleBriefingBlocked = (item: BriefingItem) => {
    if (typeof item.taskId !== "number") return;
    updateTask.mutate(
      { id: item.taskId, data: { status: "blocked" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: today }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getBriefingTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getDashboardRecapQueryKey() });
          toast({ title: "Marked blocked", description: item.title });
        },
      },
    );
  };

  const handleAddOwn = () => {
    document.getElementById("tasks-section")?.scrollIntoView({ behavior: "smooth" });
  };

  // Show full-page error if BOTH critical queries fail (API likely down).
  if (summaryError && tasksError) {
    return (
      <div className="space-y-6 pt-4">
        <DataLoadError
          title="Couldn't load your day"
          message="Your assistant can't reach the server right now. Your data is safe — we just need to retry."
          onRetry={() => {
            refetchSummary();
            refetchTasks();
          }}
        />
      </div>
    );
  }

  if (summaryLoading && tasksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        {showEveningRecap ? <EveningRecapCardSkeleton /> : <BriefingCardSkeleton />}
      </div>
    );
  }

  const areaMap = new Map(areas?.map((a) => [a.id, a]) ?? []);
  const briefing = briefingQuery.data;
  const recap = recapQuery.data;
  const headlineFromBriefing = showEveningRecap
    ? recap?.headline ?? "Day's done."
    : briefing?.headline ?? "Today, in focus.";
  const greetingFromBriefing = showEveningRecap
    ? recap?.greeting ?? ""
    : briefing?.greeting ?? "";
  const showBriefing = !isViewingHistory && !showEveningRecap;
  const reasoningByTaskId = new Map<number, string>();
  if (briefing?.briefing) {
    for (const item of briefing.briefing) {
      if (typeof item.taskId === "number" && item.reasoning) {
        reasoningByTaskId.set(item.taskId, item.reasoning);
      }
    }
  }

  return (
    <div className="space-y-6">
      <AddTaskDialog
        date={viewDate}
        open={emptyAddTaskOpen}
        onOpenChange={setEmptyAddTaskOpen}
      />

      {/* Today's plan — promoted to the top of the page */}
      {showBriefing && (
        <div onMouseEnter={markBriefingViewed} className="pt-2">
          {briefingQuery.isLoading && <BriefingCardSkeleton />}
          {briefingQuery.isError && (
            <BriefingCardError onRetry={() => briefingQuery.refetch()} />
          )}
          {briefing && (
            <>
              <BriefingCard
                briefing={briefing}
                isReshuffling={reshuffleMutation.isPending}
                isApproving={approveMutation.isPending}
                onApprove={() => approveMutation.mutate()}
                onReshuffle={() => reshuffleMutation.mutate()}
                onAddOwn={handleAddOwn}
                onStartFocus={handleBriefingStart}
                onMarkDone={handleBriefingMarkDone}
                onPushTask={handleBriefingPush}
                onMarkBlocked={handleBriefingBlocked}
                onChooseActiveAreas={() => navigate("/areas")}
                onAddTask={() => setEmptyAddTaskOpen(true)}
              />
              {briefing.signoff && briefing.briefing.length > 0 && (
                <p className="text-sm italic text-muted-foreground px-1 mt-2">
                  {briefing.signoff}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Demoted header — sits below the plan as flavor, not the headline */}
      {!isViewingHistory && (
        <motion.section
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          data-testid="briefing-header"
        >
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {formatDateMono(today)}
          </p>
          <p className="font-serif text-base text-muted-foreground mt-1">
            {greetingFromBriefing || "Welcome back."}{" "}
            <span className="text-foreground/70">{headlineFromBriefing}</span>
          </p>
        </motion.section>
      )}

      {/* Onboarding checklist — auto-hides once complete */}
      {!isViewingHistory && (
        <OnboardingChecklist
          hasAreas={(areas?.length ?? 0) > 0}
          hasTasks={(tasks?.length ?? 0) > 0}
        />
      )}

      {/* Onboarding wizard — first-run only */}
      <OnboardingWizard
        open={showWizard}
        onComplete={() => { markOnboardingComplete(); setShowWizard(false); }}
      />

      {/* Evening recap zone */}
      {recapEnabled && (
        <>
          {recapQuery.isLoading && <EveningRecapCardSkeleton />}
          {recapQuery.isError && (
            <EveningRecapCardError onRetry={() => recapQuery.refetch()} />
          )}
          {recap && (
            <>
              <EveningRecapCard
                recap={recap}
                isRegenerating={regenerateRecapMutation.isPending}
                onRegenerate={() => regenerateRecapMutation.mutate()}
                onPlanTomorrow={() => navigate("/calendar?view=week")}
                onSaveReflection={(text) =>
                  saveReflectionMutation.mutate({ reflection: text })
                }
              />
              {recap.signoff && (
                <p className="text-sm italic text-muted-foreground px-1">
                  {recap.signoff}
                </p>
              )}
            </>
          )}
        </>
      )}


      {/* Active areas (kept) */}
      {summary?.activeAreas && summary.activeAreas.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-serif text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Active this week
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.activeAreas.map((area) => (
              /* Phase 1 UX: dropped the per-area colored dot. With four
                 active areas each in their own color plus a colored
                 priority pill, the row had eight competing color signals.
                 Priority badge alone gives hierarchy without the rainbow.
                 Phase 2: chip is now a link into the per-area brain-dump
                 page, so users can jump from "Active this week" straight
                 into adding/managing tasks for that area. */
              <Link
                key={area.id}
                href={`/areas/${area.id}`}
                aria-label={`Open ${area.name}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-card-border text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-foreground">{area.name}</span>
                <PriorityBadge priority={area.priority} />
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {/* This week's focus — collapsible. Default closed; expand on tap.
          The dashboard is today-first; weekly context is one click away. */}
      {summary?.weeklyPlan && (() => {
        const wp = summary.weeklyPlan;
        const priorityCount = wp.priorities.length;
        const focusCount =
          (wp.healthFocus ? 1 : 0) +
          (wp.businessFocus ? 1 : 0) +
          (wp.creativeFocus ? 1 : 0);
        const previewBits: string[] = [];
        if (priorityCount > 0) {
          previewBits.push(`${priorityCount} ${priorityCount === 1 ? "priority" : "priorities"}`);
        }
        if (focusCount > 0) {
          previewBits.push(`${focusCount} focus ${focusCount === 1 ? "area" : "areas"}`);
        }
        const preview = previewBits.join(" · ") || "Tap to view.";
        return (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-card border border-card-border"
          >
            <button
              type="button"
              onClick={toggleThisWeek}
              aria-expanded={thisWeekOpen}
              aria-controls="this-week-panel"
              className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {thisWeekOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <span className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  This week
                </span>
              </div>
              {!thisWeekOpen && (
                <span className="text-xs text-muted-foreground truncate">{preview}</span>
              )}
            </button>
            {thisWeekOpen && (
              <div id="this-week-panel" className="px-4 pb-4 pt-1 border-t border-card-border/60">
                {priorityCount > 0 && (
                  <ul className="space-y-1.5 mb-2 mt-2">
                    {wp.priorities.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-primary font-bold mt-0.5">·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
                {focusCount > 0 && (
                  <div className="space-y-1.5">
                    {wp.healthFocus && <FocusLine label="Health" value={wp.healthFocus} />}
                    {wp.businessFocus && <FocusLine label="Business" value={wp.businessFocus} />}
                    {wp.creativeFocus && <FocusLine label="Creative" value={wp.creativeFocus} />}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        );
      })()}

      {/* Today's progress (kept) */}
      {tasks && tasks.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-serif text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Today's progress
          </h2>
          <ProgressSummary
            doneCount={summary?.doneCount ?? 0}
            pushedCount={summary?.pushedCount ?? 0}
            passedCount={summary?.passedCount ?? 0}
            blockedCount={summary?.blockedCount ?? 0}
            totalCount={tasks.length}
          />
        </motion.section>
      )}

      {/* Weekly plan nudge — small banner only when no plan exists */}
      {!summaryLoading &&
        summary &&
        !summary.weeklyPlan && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs font-medium text-foreground">
                Plan this week to give your assistant more context.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl gap-1.5 text-primary text-xs font-semibold shrink-0"
              onClick={() => navigate("/calendar?view=week")}
            >
              Plan
              <ArrowRight className="h-3 w-3" />
            </Button>
          </motion.section>
        )}

      {/* Historical date banner */}
      {isViewingHistory && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-700 px-4 py-3 flex items-center justify-between"
        >
          <p className="text-sm text-foreground/80">
            Viewing tasks from <strong>{formatShortDate(viewDate)}</strong>
          </p>
          <Button size="sm" variant="ghost" className="text-xs rounded-xl" onClick={() => navigate("/today")}>
            Back to today
          </Button>
        </motion.div>
      )}

      {/* Focus nudge dialog */}
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
                {FOCUS_DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedFocusDuration(d); setCustomDurationInput(""); }}
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
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  step={1}
                  value={customDurationInput}
                  onChange={e => handleCustomDurationChange(e.target.value)}
                  onBlur={handleCustomDurationCommit}
                  onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                  placeholder={isPresetDuration ? "custom" : `${selectedFocusDuration}m`}
                  aria-label="Custom focus duration in minutes"
                  className={`w-16 text-xs px-2 py-1 rounded-full border bg-transparent text-center font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    !isPresetDuration && customDurationInput !== ""
                      ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300"
                      : "border-border text-muted-foreground"
                  }`}
                />
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
          </motion.div>
        )}

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
                <p className="mt-4 text-xs text-muted-foreground">
                  Need a 5-min reset?{" "}
                  <Link
                    href="/home"
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Take one
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {pendingGroups ? (
              pendingGroups.map((group) => (
                <div key={group.areaId ?? "unassigned"} className="space-y-2">
                  {(pendingGroups.length > 1 || group.areaId === null) && (
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
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        date={viewDate}
                        areaMap={areaMap}
                        areaPriorities={summary?.weeklyPlan?.areaPriorities ?? []}
                          reasoningByTaskId={reasoningByTaskId}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <AnimatePresence mode="popLayout">
                {pendingTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    date={viewDate}
                    areaMap={areaMap}
                    areaPriorities={summary?.weeklyPlan?.areaPriorities ?? []}
                          reasoningByTaskId={reasoningByTaskId}
                  />
                ))}
              </AnimatePresence>
            )}
            {completedTasks.length > 0 && (
              <>
                {pendingTasks.length > 0 && <div className="border-t border-dashed border-border my-2" />}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Completed</p>
                {completedGroups ? (
                  completedGroups.map((group) => (
                    <div key={group.areaId ?? "unassigned"} className="space-y-2">
                      {(completedGroups.length > 1 || group.areaId === null) && (
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
                        {group.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            date={viewDate}
                            areaMap={areaMap}
                            areaPriorities={summary?.weeklyPlan?.areaPriorities ?? []}
                          reasoningByTaskId={reasoningByTaskId}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  <AnimatePresence mode="popLayout">
                    {completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        date={viewDate}
                        areaMap={areaMap}
                        areaPriorities={summary?.weeklyPlan?.areaPriorities ?? []}
                          reasoningByTaskId={reasoningByTaskId}
                      />
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

function FocusLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm text-foreground/80">{value}</p>
    </div>
  );
}
