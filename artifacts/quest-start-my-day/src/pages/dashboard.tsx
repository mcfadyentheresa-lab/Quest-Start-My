import { AnimatePresence, motion } from "framer-motion";
import { useGetDashboardSummary, useListTasks, getListTasksQueryKey } from "@workspace/api-client-react";
import { TaskCard } from "@/components/task-card";
import { ProgressSummary } from "@/components/progress-summary";
import { PriorityBadge, PriorityLegend } from "@/components/priority-badge";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: tasks, isLoading: tasksLoading } = useListTasks(
    { date: today },
    { query: { queryKey: getListTasksQueryKey({ date: today }) } }
  );

  const pendingTasks = tasks?.filter(t => t.status === "pending") ?? [];
  const completedTasks = tasks?.filter(t => t.status !== "pending") ?? [];

  if (summaryLoading && tasksLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

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
          {summary.weeklyPlan.healthFocus && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Health focus</p>
              <p className="text-sm text-foreground/80">{summary.weeklyPlan.healthFocus}</p>
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

      {/* Today's tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base font-medium text-foreground">Today's tasks</h2>
          <AddTaskDialog date={today}>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add task
            </Button>
          </AddTaskDialog>
        </div>

        {tasksLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-card border border-dashed border-border">
            <Sprout className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No tasks yet for today</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Add up to 3 tasks to get started</p>
            <AddTaskDialog date={today} />
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {pendingTasks.map(task => (
                <TaskCard key={task.id} task={task} date={today} />
              ))}
            </AnimatePresence>
            {completedTasks.length > 0 && (
              <>
                {pendingTasks.length > 0 && <div className="border-t border-dashed border-border my-2" />}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Completed</p>
                <AnimatePresence mode="popLayout">
                  {completedTasks.map(task => (
                    <TaskCard key={task.id} task={task} date={today} />
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
