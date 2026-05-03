/**
 * Inbox — undated tasks the user brain-dumped without scheduling.
 *
 * Each row offers three triage actions:
 *   - Today: schedule the task for today's date
 *   - Schedule…: pick any future date
 *   - Delete: drop the task
 *
 * The page is intentionally minimal. Once a task gets a date it leaves
 * this list and shows up on its scheduled day.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Inbox as InboxIcon, CalendarPlus, Trash2, ArrowRight, Loader2 } from "lucide-react";
import {
  useGetTaskInbox,
  useUpdateTask,
  useDeleteTask,
  getGetTaskInboxQueryKey,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  type Task,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tasks, isLoading } = useGetTaskInbox();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pickingDateId, setPickingDateId] = useState<number | null>(null);

  const invalidate = (date: string | null) => {
    queryClient.invalidateQueries({ queryKey: getGetTaskInboxQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    if (date) {
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date }) });
    }
  };

  const schedule = async (task: Task, date: string) => {
    setBusyId(task.id);
    try {
      await updateTask.mutateAsync({ id: task.id, data: { date } });
      invalidate(date);
      toast({ title: date === todayIso() ? "Added to today." : `Scheduled for ${date}.` });
    } catch {
      toast({ title: "Couldn't schedule task.", variant: "destructive" });
    } finally {
      setBusyId(null);
      setPickingDateId(null);
    }
  };

  const remove = async (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setBusyId(task.id);
    try {
      await deleteTask.mutateAsync({ id: task.id });
      invalidate(null);
    } catch {
      toast({ title: "Couldn't delete task.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-32">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <InboxIcon className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-serif text-2xl font-medium">Inbox</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Brain-dumped tasks waiting for a day. Schedule them, or delete what's no longer worth doing.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <InboxIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Inbox empty</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            New brain-dumps land here when you pick "Later" in the composer.
          </p>
          <Link href="/today">
            <Button size="sm" variant="ghost" className="rounded-xl">
              Back to today <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const isBusy = busyId === task.id;
            const isPicking = pickingDateId === task.id;
            return (
              <li
                key={task.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="text-sm text-foreground leading-snug mb-3">{task.title}</p>
                {isPicking ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      min={todayIso()}
                      defaultValue={todayIso()}
                      className="text-xs rounded-xl border border-border bg-background px-3 py-1.5"
                      autoFocus
                      onChange={(e) => {
                        if (e.target.value) schedule(task, e.target.value);
                      }}
                      aria-label="Pick a date"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs"
                      onClick={() => setPickingDateId(null)}
                      disabled={isBusy}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="rounded-xl text-xs h-8"
                      onClick={() => schedule(task, todayIso())}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Today"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs h-8"
                      onClick={() => setPickingDateId(task.id)}
                      disabled={isBusy}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                      Schedule
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl text-xs h-8 text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => remove(task)}
                      disabled={isBusy}
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
