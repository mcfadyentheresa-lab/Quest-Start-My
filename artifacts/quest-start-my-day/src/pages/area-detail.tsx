/**
 * /areas/:id — the brain-dump page for a single area.
 *
 * Phase 2 UX cleanup. Goal: reduce mental load by giving the user one
 * place per area where they can dump every task they're carrying for it,
 * mark things done, and let Quest sort the rest later.
 *
 * NOT YET IN THIS PAGE (Phase 3):
 *   - AI sub-task breakdown (preview-batch modal)
 *   - Inline editing of whyItMatters / doneLooksLike / suggestedNextStep
 *   - Drag-to-reorder
 */
import { useState, useMemo, useRef } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAreas,
  useListAreaTasks,
  useCreateTask,
  useUpdateTask,
  getListAreaTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getListTasksQueryKey,
  type Task,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, CheckCircle2, Undo2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/hooks/use-toast";

/** Today's date in YYYY-MM-DD (server expects this for new task `date`). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Split a brain-dump textarea into individual task titles.
 * Each non-empty line becomes one task. Trims whitespace, drops empties,
 * caps title length so a giant accidental paste doesn't blow up the UI.
 */
function splitDumpIntoTitles(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.length > 280 ? line.slice(0, 280) : line));
}

export default function AreaDetailPage() {
  const [, params] = useRoute("/areas/:id");
  const areaId = params?.id ? Number(params.id) : NaN;
  const validId = Number.isInteger(areaId) && areaId > 0;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // We use the cached areas list rather than a per-area fetch so loading the
  // detail page from the dashboard or areas list is instant — areas are
  // small and already in cache from the layout-level usage.
  const { data: areas, isLoading: areasLoading } = useListAreas();
  const area = areas?.find((a) => a.id === areaId);

  const tasksQuery = useListAreaTasks(areaId, {
    query: {
      queryKey: getListAreaTasksQueryKey(areaId),
      enabled: validId,
    },
  });

  const tasks = tasksQuery.data ?? [];
  const pending = tasks.filter((t) => t.status === "pending");
  const recentlyClosed = tasks
    .filter((t) => t.status === "done")
    .slice(0, 5);

  const invalidateAreaData = () => {
    if (!validId) return;
    queryClient.invalidateQueries({ queryKey: getListAreaTasksQueryKey(areaId) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    // Also invalidate the today list so newly added tasks dated today show
    // up on the dashboard immediately.
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
  };

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  // ---- Brain-dump form state ----
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftLines = useMemo(() => splitDumpIntoTitles(draft), [draft]);

  /**
   * Submit one or more new tasks from the brain-dump textarea. We fire
   * mutations in parallel because the create endpoint is idempotent at
   * the row level. Toast shows the aggregate result so the user sees
   * "added 3" rather than three sequential pings.
   */
  const handleSubmitDraft = async () => {
    if (!validId || draftLines.length === 0) return;
    const titles = draftLines;
    setDraft("");

    const date = todayIso();
    const results = await Promise.allSettled(
      titles.map((title) =>
        createTask.mutateAsync({
          data: {
            title,
            category: "business", // safe default for brain-dump; user can recategorize later
            areaId,
            date,
          },
        }),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;

    invalidateAreaData();

    if (failed === 0) {
      toast({
        title: ok === 1 ? "Added" : `Added ${ok}`,
        description: ok === 1 ? titles[0] : "Quest will help you plan the rest.",
      });
    } else if (ok === 0) {
      toast({
        title: "Couldn't save",
        description: "Try again in a second.",
        variant: "destructive",
      });
      // Restore the failed text so the user doesn't lose it.
      setDraft(titles.join("\n"));
    } else {
      toast({
        title: `Added ${ok} of ${results.length}`,
        description: `${failed} didn't save — try again.`,
      });
    }
  };

  const handleToggleDone = (task: Task) => {
    const nextStatus = task.status === "done" ? "pending" : "done";
    updateTask.mutate(
      { id: task.id, data: { status: nextStatus } },
      {
        onSuccess: () => {
          invalidateAreaData();
          if (nextStatus === "done") {
            toast({ title: "Done", description: task.title });
          } else {
            toast({ title: "Reopened", description: task.title });
          }
        },
        onError: () => {
          toast({ title: "Couldn't update", variant: "destructive" });
        },
      },
    );
  };

  // ---- Render branches ----
  if (!validId) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">That area link looks off.</p>
      </div>
    );
  }

  if (areasLoading || (!area && tasksQuery.isLoading)) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-muted-foreground">Couldn't find that area.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header — area name + priority. No color dot, per Phase 1 cleanup. */}
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-serif text-2xl font-medium text-foreground">
            {area.name}
          </h1>
          <PriorityBadge priority={area.priority} />
        </div>
        {area.description && (
          <p className="text-sm text-muted-foreground">{area.description}</p>
        )}
      </header>

      {/* Brain-dump box. Single textarea, multi-line dump supported.
          Cmd/Ctrl+Enter submits. Plain Enter inserts a newline because
          this is meant to be a list-style dump, not a chat input. */}
      <section
        aria-labelledby="brain-dump-heading"
        className="rounded-2xl bg-card border border-card-border p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="brain-dump-heading" className="text-sm font-medium text-foreground">
            What's on your mind for {area.name}?
          </h2>
        </div>
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter = submit. Plain Enter = newline (list mode).
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSubmitDraft();
            }
          }}
          placeholder={
            "Dump everything. One task per line.\nQuest will help you plan it later."
          }
          rows={Math.max(3, Math.min(8, draftLines.length + 1))}
          className="resize-y min-h-[88px]"
          aria-describedby="brain-dump-hint"
        />
        <div className="flex items-center justify-between gap-3">
          <p id="brain-dump-hint" className="text-xs text-muted-foreground">
            {draftLines.length === 0
              ? "Tip: Cmd/Ctrl+Enter to add."
              : `Will add ${draftLines.length} ${draftLines.length === 1 ? "task" : "tasks"}.`}
          </p>
          <Button
            size="sm"
            onClick={() => void handleSubmitDraft()}
            disabled={draftLines.length === 0 || createTask.isPending}
            className="rounded-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {createTask.isPending
              ? "Adding…"
              : draftLines.length > 1
                ? `Add ${draftLines.length}`
                : "Add"}
          </Button>
        </div>
      </section>

      {/* Open tasks */}
      <section aria-labelledby="open-tasks-heading" className="space-y-2">
        <h2
          id="open-tasks-heading"
          className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide"
        >
          Open ({pending.length})
        </h2>
        {tasksQuery.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : pending.length === 0 ? (
          <div className="rounded-2xl bg-card border border-card-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0
                ? "Nothing here yet. Start dumping."
                : "All caught up for now."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggleDone(task)}
                  pending={updateTask.isPending}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* Recently closed — last 5, with undo. */}
      {recentlyClosed.length > 0 && (
        <section aria-labelledby="recent-closed-heading" className="space-y-2">
          <h2
            id="recent-closed-heading"
            className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide"
          >
            Recently closed
          </h2>
          <ul className="space-y-1.5">
            {recentlyClosed.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-card/60 border border-card-border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden />
                  <span className="text-sm text-muted-foreground line-through truncate">
                    {task.title}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleToggleDone(task)}
                  aria-label={`Reopen ${task.title}`}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  Undo
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/areas"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      data-testid="back-to-areas"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All areas
    </Link>
  );
}

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  pending: boolean;
}

function TaskRow({ task, onToggle, pending }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(task.whyItMatters || task.doneLooksLike || task.suggestedNextStep);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl bg-card border border-card-border"
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          aria-label={`Mark "${task.title}" done`}
          className="mt-0.5 h-5 w-5 rounded-full border border-card-border hover:border-foreground transition-colors flex items-center justify-center flex-shrink-0 disabled:opacity-50"
        >
          {/* Empty circle; we don't render the checkmark here because the
              row leaves the list as soon as it flips to done. */}
        </button>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => hasDetail && setExpanded((v) => !v)}
            className={`block w-full text-left text-sm font-medium text-foreground ${
              hasDetail ? "cursor-pointer hover:text-foreground/80" : "cursor-default"
            }`}
            aria-expanded={hasDetail ? expanded : undefined}
          >
            {task.title}
          </button>
          {hasDetail && expanded && (
            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {task.whyItMatters && (
                <p>
                  <span className="font-medium text-foreground/80">Why: </span>
                  {task.whyItMatters}
                </p>
              )}
              {task.doneLooksLike && (
                <p>
                  <span className="font-medium text-foreground/80">Done looks like: </span>
                  {task.doneLooksLike}
                </p>
              )}
              {task.suggestedNextStep && (
                <p>
                  <span className="font-medium text-foreground/80">Next step: </span>
                  {task.suggestedNextStep}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}
