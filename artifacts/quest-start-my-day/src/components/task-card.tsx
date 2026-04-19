import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, SkipForward, Pause, AlertCircle, ChevronDown, ChevronUp, Trash2, Pencil } from "lucide-react";
import { useUpdateTask, useDeleteTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTasksQueryKey, getGetDashboardSummaryQueryKey, getGetReentryTaskQueryKey } from "@workspace/api-client-react";
import { CategoryBadge } from "@/components/category-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TaskDetailSheet } from "@/components/task-detail-sheet";

interface Pillar {
  id: number;
  name: string;
  color?: string | null;
}

interface Task {
  id: number;
  title: string;
  category: string;
  whyItMatters?: string | null;
  doneLooksLike?: string | null;
  suggestedNextStep?: string | null;
  blockerReason?: string | null;
  status: string;
  date: string;
  pillarId?: number | null;
  milestoneId?: number | null;
}

interface TaskCardProps {
  task: Task;
  date: string;
  pillarMap?: Map<number, Pillar>;
  activePillarIds?: number[];
}

const statusConfig = {
  done: { icon: CheckCircle2, label: "Done", className: "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10" },
  pushed: { icon: SkipForward, label: "Pushed", className: "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/10" },
  passed: { icon: Pause, label: "Passed", className: "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/10" },
  blocked: { icon: AlertCircle, label: "Blocked", className: "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/10" },
  pending: { icon: null, label: "Pending", className: "border-border bg-card" },
};

export function TaskCard({ task, date, pillarMap, activePillarIds }: TaskCardProps) {
  const [expanded, setExpanded] = useState(task.status === "pending");
  const [blockerDraft, setBlockerDraft] = useState("");
  const [showBlockerInput, setShowBlockerInput] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const statusInfo = statusConfig[task.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const pillar = task.pillarId && pillarMap ? pillarMap.get(task.pillarId) : undefined;
  const isActivePillar = pillar && activePillarIds ? activePillarIds.includes(pillar.id) : false;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
  };

  const handleAction = (status: "done" | "pushed" | "passed" | "blocked") => {
    if (status === "blocked") {
      setShowBlockerInput(true);
      return;
    }
    updateTask.mutate(
      { id: task.id, data: { status } },
      {
        onSuccess: () => {
          invalidateAll();
          if (status === "done") setExpanded(false);
        },
        onError: () => {
          toast({ title: "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const handleConfirmBlocked = () => {
    updateTask.mutate(
      { id: task.id, data: { status: "blocked", blockerReason: blockerDraft.trim() || undefined } },
      {
        onSuccess: () => {
          invalidateAll();
          setShowBlockerInput(false);
          setBlockerDraft("");
        },
        onError: () => {
          toast({ title: "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteTask.mutate({ id: task.id }, { onSuccess: invalidateAll });
  };

  const isPending = task.status === "pending";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`rounded-2xl border-2 p-5 transition-all duration-200 ${statusInfo.className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge category={task.category} />
            {pillar && isActivePillar && (
              <span
                className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: pillar.color ? `${pillar.color}55` : undefined,
                  backgroundColor: pillar.color ? `${pillar.color}18` : undefined,
                  color: pillar.color ?? undefined,
                }}
              >
                {pillar.color && (
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: pillar.color }} />
                )}
                {pillar.name}
              </span>
            )}
            {task.status !== "pending" && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                task.status === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                task.status === "pushed" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                task.status === "passed" ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" :
                "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              }`}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <button
            className="text-left w-full group"
            onClick={() => setDetailOpen(true)}
            aria-label="View and edit task details"
          >
            <h3 className={`font-serif text-lg font-medium leading-snug group-hover:underline decoration-dotted underline-offset-2 ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.title}
            </h3>
          </button>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
          <button
            onClick={() => setDetailOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {task.whyItMatters && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Why this matters</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.whyItMatters}</p>
                </div>
              )}
              {task.doneLooksLike && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Done looks like</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.doneLooksLike}</p>
                </div>
              )}
              {task.suggestedNextStep && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Suggested next step</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.suggestedNextStep}</p>
                </div>
              )}
              {task.status === "blocked" && task.blockerReason && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">Blocker</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.blockerReason}</p>
                </div>
              )}
            </div>

            {isPending && !showBlockerInput && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  onClick={() => handleAction("done")}
                  disabled={updateTask.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-xl font-medium"
                  onClick={() => handleAction("pushed")}
                  disabled={updateTask.isPending}
                >
                  <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                  Push one step
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-medium"
                  onClick={() => handleAction("passed")}
                  disabled={updateTask.isPending}
                >
                  <Pause className="h-3.5 w-3.5 mr-1.5" />
                  Pass for now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-medium text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/20"
                  onClick={() => handleAction("blocked")}
                  disabled={updateTask.isPending}
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Blocked
                </Button>
              </div>
            )}

            {isPending && showBlockerInput && (
              <div className="mt-4 space-y-2">
                <Textarea
                  value={blockerDraft}
                  onChange={e => setBlockerDraft(e.target.value)}
                  placeholder="What's blocking this? (optional)"
                  className="rounded-xl resize-none text-sm"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs"
                    onClick={() => { setShowBlockerInput(false); setBlockerDraft(""); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-900/20"
                    onClick={handleConfirmBlocked}
                    disabled={updateTask.isPending}
                  >
                    <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                    Mark blocked
                  </Button>
                </div>
              </div>
            )}

            {!isPending && (
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-medium"
                  onClick={() => updateTask.mutate({ id: task.id, data: { status: "pending" } }, { onSuccess: invalidateAll })}
                >
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <TaskDetailSheet task={task} open={detailOpen} onOpenChange={setDetailOpen} />
    </motion.div>
  );
}
