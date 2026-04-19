import { AnimatePresence, motion } from "framer-motion";
import {
  useGetDashboardSummary,
  useListTasks,
  useGetReentryTask,
  useUpdateTask,
  useListPillars,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
} from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { ProgressSummary } from "@/components/progress-summary";
import { PriorityBadge, PriorityLegend } from "@/components/priority-badge";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Sprout, ArrowRight, CheckCircle2, ExternalLink, CalendarDays } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";

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

  const pendingTasks = tasks?.filter(t => t.status === "pending") ?? [];
  const completedTasks = tasks?.filter(t => t.status !== "pending") ?? [];

  const handleJumpToTask = () => {
    if (!reentry?.task) return;
    setDateParam(reentry.task.date);
    setTimeout(() => {
      document.getElementById("tasks-section")?.scrollIntoView({ behavior: "smooth" });
    }, 200);
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
          <p className="font-serif text-base font-medium text-foreground leading-snug">
            {reentry.task.title}
          </p>
          {reentry.task.date !== today && (
            <p className="text-xs text-muted-foreground mt-0.5">From {formatShortDate(reentry.task.date)}</p>
          )}
          {reentry.task.suggestedNextStep && (
            <div className="mt-2 flex items-start gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">{reentry.task.suggestedNextStep}</p>
            </div>
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
            <AnimatePresence mode="popLayout">
              {pendingTasks.map(task => (
                <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
              ))}
            </AnimatePresence>
            {completedTasks.length > 0 && (
              <>
                {pendingTasks.length > 0 && <div className="border-t border-dashed border-border my-2" />}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Completed</p>
                <AnimatePresence mode="popLayout">
                  {completedTasks.map(task => (
                    <TaskCard key={task.id} task={task} date={viewDate} pillarMap={pillarMap} activePillarIds={summary?.activePillars?.map(p => p.id) ?? []} />
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
