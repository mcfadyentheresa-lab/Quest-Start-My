import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useGetDashboardSummary,
  useListTasks,
  useUpdateTask,
  useCreateTask,
  useListPillars,
  useListDailyPlans,
  useGetBriefingToday,
  useReshuffleBriefing,
  useApproveBriefing,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getListDailyPlansQueryKey,
  getBriefingTodayQueryKey,
} from "@workspace/api-client-react";
import type { BriefingItem } from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { ProgressSummary } from "@/components/progress-summary";
import { PriorityBadge } from "@/components/priority-badge";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { FocusTimerWidget } from "@/components/focus-timer-widget";
import { FocusNudgeDialog } from "@/components/focus-nudge-dialog";
import { useFocusTimer, clampDuration, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from "@/hooks/use-focus-timer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Sprout, ArrowRight, CalendarDays, Timer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";
import {
  BriefingCard,
  BriefingCardSkeleton,
  BriefingCardError,
} from "@/components/briefing-card";

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

  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: tasks, isLoading: tasksLoading } = useListTasks(
    { date: viewDate },
    { query: { queryKey: getListTasksQueryKey({ date: viewDate }) } },
  );
  const { data: pillars } = useListPillars();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const briefingQuery = useGetBriefingToday({
    query: {
      queryKey: getBriefingTodayQueryKey(),
      enabled: !isViewingHistory && (summary?.activePillars?.length ?? 0) > 0,
      staleTime: 60 * 1000,
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

  function groupByPillar(taskList: typeof pendingTasks) {
    if (!pillars || pillars.length === 0) return null;
    const pillarIds = new Set(pillars.map((p) => p.id));
    const groups = new Map<number | null, typeof pendingTasks>();
    for (const task of taskList) {
      const key = task.pillarId && pillarIds.has(task.pillarId) ? task.pillarId : null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }
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
    const pillar = pillars?.find((p) => p.name === item.pillarName) ?? null;
    const category = pillar?.category ?? "business";
    createTask.mutate(
      {
        data: {
          title: item.title,
          category,
          date: today,
          pillarId: pillar?.id ?? null,
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
          toast({ title: "Marked blocked", description: item.title });
        },
      },
    );
  };

  const handleAddOwn = () => {
    document.getElementById("tasks-section")?.scrollIntoView({ behavior: "smooth" });
  };

  if (summaryLoading && tasksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <BriefingCardSkeleton />
      </div>
    );
  }

  const pillarMap = new Map(pillars?.map((p) => [p.id, p]) ?? []);
  const briefing = briefingQuery.data;
  const headlineFromBriefing = briefing?.headline ?? "Today, in focus.";
  const greetingFromBriefing = briefing?.greeting ?? "";
  const showBriefing = !isViewingHistory && (summary?.activePillars?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Confident header */}
      {!isViewingHistory && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-2"
          data-testid="briefing-header"
        >
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {formatDateMono(today)}
          </p>
          <h1 className="font-serif text-3xl font-medium text-foreground mt-2 leading-tight">
            {greetingFromBriefing || "Welcome back."}
          </h1>
          <p className="font-serif text-xl text-foreground/70 mt-1">
            {headlineFromBriefing}
          </p>
        </motion.section>
      )}

      {/* Briefing zone */}
      {showBriefing && (
        <>
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
              />
              {briefing.signoff && (
                <p className="text-sm italic text-muted-foreground px-1">
                  {briefing.signoff}
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* Empty pillars state */}
      {!isViewingHistory && (summary?.activePillars?.length ?? 0) === 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-border bg-card p-6 text-center"
        >
          <p className="font-serif text-base text-foreground mb-1">
            Set up your pillars to get a daily briefing.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Pillars give your assistant the context to draft today's plan.
          </p>
          <Button onClick={() => navigate("/pillars")} size="sm" className="rounded-xl">
            Add your pillars
          </Button>
        </motion.section>
      )}

      {/* Active pillars (kept) */}
      {summary?.activePillars && summary.activePillars.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-serif text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Active this week
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.activePillars.map((pillar) => (
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

      {/* This week's focus (kept, simplified) */}
      {summary?.weeklyPlan && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-card border border-card-border p-4"
        >
          {summary.weeklyPlan.priorities.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {summary.weeklyPlan.priorities.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-primary font-bold mt-0.5">·</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {(summary.weeklyPlan.healthFocus || summary.weeklyPlan.businessFocus || summary.weeklyPlan.creativeFocus) && (
            <div className="space-y-1.5">
              {summary.weeklyPlan.healthFocus && (
                <FocusLine label="Health" value={summary.weeklyPlan.healthFocus} />
              )}
              {summary.weeklyPlan.businessFocus && (
                <FocusLine label="Business" value={summary.weeklyPlan.businessFocus} />
              )}
              {summary.weeklyPlan.creativeFocus && (
                <FocusLine label="Creative" value={summary.weeklyPlan.creativeFocus} />
              )}
            </div>
          )}
        </motion.section>
      )}

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
              onClick={() => navigate("/weekly")}
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
          <Button size="sm" variant="ghost" className="text-xs rounded-xl" onClick={() => navigate("/")}>
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
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        date={viewDate}
                        pillarMap={pillarMap}
                        activePillarIds={summary?.activePillars?.map((p) => p.id) ?? []}
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
                    pillarMap={pillarMap}
                    activePillarIds={summary?.activePillars?.map((p) => p.id) ?? []}
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
                        {group.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            date={viewDate}
                            pillarMap={pillarMap}
                            activePillarIds={summary?.activePillars?.map((p) => p.id) ?? []}
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
                        pillarMap={pillarMap}
                        activePillarIds={summary?.activePillars?.map((p) => p.id) ?? []}
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
