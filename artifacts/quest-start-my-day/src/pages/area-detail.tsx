/**
 * /areas/:id — the brain-dump page for a single area.
 *
 * Phase 4: header is now the edit surface. Click name/description/priority/
 * portfolio status to change them inline (the old Edit-area modal is gone).
 * A soft "Honest note" sits at the top — optional, muted, for friction the
 * user wants to acknowledge without surfacing it across the app.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAreas,
  useListAreaTasks,
  useCreateTask,
  useUpdateTask,
  useUpdateArea,
  getListAreaTasksQueryKey,
  getListAreasQueryKey,
  getGetDashboardSummaryQueryKey,
  getListTasksQueryKey,
  type Task,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, CheckCircle2, Undo2, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriorityBadge } from "@/components/priority-badge";
import { useToast } from "@/hooks/use-toast";

const PORTFOLIO_STATUSES = ["Active", "Warm", "Parked"] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
type Priority = typeof PRIORITIES[number];

const portfolioStatusStyles: Record<PortfolioStatus, string> = {
  Active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  Warm: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  Parked: "text-muted-foreground bg-muted/50",
};

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

function nextPriority(p: string): Priority {
  const i = PRIORITIES.indexOf(p as Priority);
  return PRIORITIES[(i === -1 ? 0 : (i + 1) % PRIORITIES.length)] as Priority;
}

export default function AreaDetailPage() {
  const [, params] = useRoute("/areas/:id");
  const areaId = params?.id ? Number(params.id) : NaN;
  const validId = Number.isInteger(areaId) && areaId > 0;

  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
  };

  const invalidateAreasList = () => {
    queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateArea = useUpdateArea();

  // ---- Brain-dump form state ----
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftLines = useMemo(() => splitDumpIntoTitles(draft), [draft]);

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
            category: "business",
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

  // ---- Inline-edit save helper ----
  const saveAreaPatch = (data: Record<string, unknown>) => {
    if (!area) return;
    updateArea.mutate(
      { id: area.id, data },
      {
        onSuccess: () => invalidateAreasList(),
        onError: () => toast({ title: "Couldn't save", variant: "destructive" }),
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

      {/* Header — name, priority, portfolio status all inline-editable. */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <InlineHeading
              value={area.name}
              onSave={(v) => {
                if (v !== area.name) saveAreaPatch({ name: v });
              }}
            />
            <PriorityCycler
              priority={area.priority}
              onCycle={(next) => saveAreaPatch({ priority: next })}
            />
          </div>
          <PortfolioStatusInline
            status={(area.portfolioStatus ?? "Active") as PortfolioStatus}
            onSelect={(s) => saveAreaPatch({ portfolioStatus: s })}
          />
        </div>
        <InlineDescription
          value={area.description ?? ""}
          onSave={(v) => {
            const cleaned = v.trim();
            const prev = area.description ?? "";
            if (cleaned !== prev) saveAreaPatch({ description: cleaned || null });
          }}
        />
      </header>

      {/* Honest note — soft, muted, optional. Sits above the brain dump. */}
      <HonestNote
        value={area.honestNote ?? ""}
        onSave={(v) => {
          const cleaned = v.trim();
          const prev = area.honestNote ?? "";
          if (cleaned !== prev) saveAreaPatch({ honestNote: cleaned || null });
        }}
      />

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

/** Click the heading to edit name. Save on blur or Enter, Escape cancels. */
function InlineHeading({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const v = draft.trim();
    if (v.length === 0) {
      setDraft(value);
    } else {
      onSave(v);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="font-serif text-2xl h-auto py-1 px-2 rounded-xl"
        aria-label="Area name"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="font-serif text-2xl font-medium text-foreground text-left hover:opacity-80 transition-opacity rounded px-1 -mx-1"
      aria-label={`Edit area name (${value})`}
    >
      {value}
    </button>
  );
}

/** Tap the badge to cycle P1 → P2 → P3 → P4 → P1. Saves on each tap. */
function PriorityCycler({ priority, onCycle }: { priority: string; onCycle: (next: Priority) => void }) {
  return (
    <button
      type="button"
      onClick={() => onCycle(nextPriority(priority))}
      aria-label={`Priority ${priority}, tap to cycle`}
      className="hover:opacity-70 active:scale-95 transition-all"
    >
      <PriorityBadge priority={priority} />
    </button>
  );
}

/** Click description to edit; save on blur or Cmd/Ctrl+Enter, Escape cancels. */
function InlineDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onSave(draft); setEditing(false); };

  if (editing) {
    return (
      <Textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        rows={2}
        placeholder="A short description (optional)"
        className="text-sm rounded-xl resize-none"
        aria-label="Area description"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors rounded px-1 -mx-1"
      aria-label={value ? "Edit description" : "Add a description"}
    >
      {value || <span className="italic opacity-70">Add a description</span>}
    </button>
  );
}

function PortfolioStatusInline({
  status,
  onSelect,
}: {
  status: PortfolioStatus;
  onSelect: (s: PortfolioStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const style = portfolioStatusStyles[status];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-70 active:scale-95 cursor-pointer ${style}`}
          aria-label={`Portfolio status: ${status}`}
        >
          {status}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1 rounded-xl" align="end" side="bottom">
        {PORTFOLIO_STATUSES.map((option) => {
          const optStyle = portfolioStatusStyles[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                setOpen(false);
                if (option !== status) onSelect(option);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <span className={`px-1.5 py-0.5 rounded-full ${optStyle}`}>{option}</span>
              {option === status && <Check className="h-3 w-3 ml-auto text-muted-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Soft, muted textarea for noting why something feels hard to start.
 * Empty state is a small placeholder; saved text shows muted above the
 * brain-dump section. Save on blur. Empty is fine.
 */
function HonestNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onSave(draft); setEditing(false); };

  if (editing) {
    return (
      <Textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        placeholder="Anything making this hard to start? Just for you."
        rows={2}
        className="text-sm rounded-xl resize-none bg-muted/30 border-dashed"
        aria-label="Honest note"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full text-left rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      aria-label={value ? "Edit honest note" : "Add an honest note"}
    >
      {value || (
        <span className="italic opacity-80">Anything making this hard to start? Just for you.</span>
      )}
    </button>
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
