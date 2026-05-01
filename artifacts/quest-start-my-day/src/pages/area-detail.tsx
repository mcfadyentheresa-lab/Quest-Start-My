/**
 * /areas/:id — the per-pillar workspace.
 *
 * Phase 3 + 4 combined. Two layers, in order of cognitive priority:
 *
 *   1. Inline-editable header (Phase 4): tap name/description/priority
 *      to change them. The old Edit-area modal is gone. A soft "Note"
 *      sits below — optional, muted, just for the user.
 *
 *   2. Goals (Phase 3): a goal is a big job. Each goal expands into its
 *      ordered steps. User can drag-reorder steps, add steps, ask AI to
 *      break the goal into 5–8 steps, or flip the goal between
 *      step-by-step ("Step-by-step") and any-order ("Any order").
 *
 *   3. Inbox below — the unassigned-task surface. Anything that isn't
 *      tied to a goal yet.
 *
 * Voice rule: chief-of-staff. Decisive, neutral pronouns, no "I"/"me",
 * no app name in user-facing copy.
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAreas,
  useListAreaTasks,
  useListMilestones,
  useCreateTask,
  useUpdateTask,
  useUpdateArea,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useBreakdownMilestone,
  useReorderMilestoneSteps,
  useBulkCreateMilestoneSteps,
  getListAreaTasksQueryKey,
  getListAreasQueryKey,
  getListMilestonesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListTasksQueryKey,
  type Task,
  type Milestone,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Undo2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Trash2,
  Wand2,
  Check,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge, PriorityHelp } from "@/components/priority-badge";
import { useToast } from "@/hooks/use-toast";

const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
type Priority = typeof PRIORITIES[number];

/** Today's date in YYYY-MM-DD (server expects this for new task `date`). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Split a brain-dump textarea into individual task titles. */
function splitDumpIntoTitles(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.length > 280 ? line.slice(0, 280) : line));
}

/** Strip a leading bullet/number prefix from a single line. */
function stripBulletPrefix(line: string): string {
  // Bullets: -, *, •, –, — (em dash), with optional spaces
  // Numbers: 1.  1)  (1)  1:
  return line.replace(/^\s*(?:[-*•–—]|\(\d+\)|\d+[.):])\s+/, "").trim();
}

/**
 * Parse pasted text into a list of step titles.
 * Splits on newlines (primary) then strips bullet/number prefixes.
 * If a single line has commas and no newlines, splits on commas — but
 * only if every chunk is < 80 chars (otherwise treat as one step).
 */
function parseStepsPaste(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Single-line, comma-separated short chunks → split on commas.
  if (lines.length === 1 && lines[0]!.includes(",")) {
    const chunks = lines[0]!
      .split(",")
      .map((c) => stripBulletPrefix(c).trim())
      .filter((c) => c.length > 0);
    if (chunks.length > 1 && chunks.every((c) => c.length < 80)) {
      return chunks.map((c) => (c.length > 280 ? c.slice(0, 280) : c));
    }
  }

  return lines
    .map((line) => stripBulletPrefix(line))
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

  const milestonesQuery = useListMilestones(
    { areaId: validId ? areaId : undefined },
    {
      query: {
        queryKey: getListMilestonesQueryKey({ areaId: validId ? areaId : undefined }),
        enabled: validId,
      },
    },
  );

  const tasks = tasksQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];

  // Unassigned = pending tasks NOT linked to any goal. These are inbox
  // items the user hasn't grouped yet.
  const looseTasks = tasks.filter((t) => t.status === "pending" && t.milestoneId == null);
  const recentlyClosed = tasks
    .filter((t) => t.status === "done")
    .slice(0, 5);

  const invalidateAreaData = () => {
    if (!validId) return;
    queryClient.invalidateQueries({ queryKey: getListAreaTasksQueryKey(areaId) });
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey({ areaId }) });
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
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const breakdownMilestone = useBreakdownMilestone();
  const reorderSteps = useReorderMilestoneSteps();
  const bulkAddSteps = useBulkCreateMilestoneSteps();

  // ---- Inbox form state ----
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftLines = useMemo(() => splitDumpIntoTitles(draft), [draft]);

  // ---- New goal form state ----
  const [newGoalTitle, setNewGoalTitle] = useState("");

  const handleCreateGoal = async () => {
    const title = newGoalTitle.trim();
    if (!validId || !title) return;
    try {
      await createMilestone.mutateAsync({
        data: {
          areaId,
          title,
          status: "planned",
          mode: "ordered",
        },
      });
      setNewGoalTitle("");
      invalidateAreaData();
      toast({ title: "Goal added", description: title });
    } catch {
      toast({ title: "Couldn't add goal", variant: "destructive" });
    }
  };

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
        description: ok === 1 ? titles[0] : "Stays in the inbox until grouped.",
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
          toast({
            title: nextStatus === "done" ? "Done" : "Reopened",
            description: task.title,
          });
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

  // Goals: open ones first (in their stored order), then completed at the
  // bottom (most recently completed first so the latest win sits closest
  // to the live work).
  const sortedGoals = (() => {
    const all = [...milestones].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id,
    );
    const open = all.filter((g) => !g.completedAt);
    const done = all
      .filter((g) => !!g.completedAt)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return [...open, ...done];
  })();

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header — name, priority, description all inline-editable. */}
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
            <PriorityHelp />
          </div>
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

      {/* Note — soft, muted, optional. Sits above the goals. */}
      <AreaNote
        value={area.honestNote ?? ""}
        onSave={(v) => {
          const cleaned = v.trim();
          const prev = area.honestNote ?? "";
          if (cleaned !== prev) saveAreaPatch({ honestNote: cleaned || null });
        }}
      />

      {/* GOALS — top of the page. */}
      <section aria-labelledby="goals-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="goals-heading"
            className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide"
          >
            Goals ({sortedGoals.length})
          </h2>
        </div>

        {/* New goal input */}
        <div className="flex gap-2">
          <Input
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreateGoal();
              }
            }}
            placeholder="Name a big job. (e.g., Launch the new site)"
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={() => void handleCreateGoal()}
            disabled={!newGoalTitle.trim() || createMilestone.isPending}
            className="rounded-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add goal
          </Button>
        </div>

        {milestonesQuery.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : sortedGoals.length === 0 ? (
          <div className="rounded-2xl bg-card border border-card-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No goals here yet. Big jobs go up top — small to-dos go in the brain dump below.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                tasks={tasks}
                onUpdateTask={(t) => handleToggleDone(t)}
                onAfterMutation={invalidateAreaData}
                breakdownPending={breakdownMilestone.isPending}
                onBreakdown={async () => {
                  try {
                    await breakdownMilestone.mutateAsync({ id: goal.id });
                    invalidateAreaData();
                    toast({
                      title: "Drafted steps.",
                      description: "Edit anytime.",
                    });
                  } catch {
                    toast({
                      title: "Couldn't draft steps.",
                      description: "This goal may already have steps. Clear them first.",
                      variant: "destructive",
                    });
                  }
                }}
                onAddStep={async (title) => {
                  await createTask.mutateAsync({
                    data: {
                      title,
                      category: "business",
                      areaId,
                      milestoneId: goal.id,
                      date: todayIso(),
                    },
                  });
                  invalidateAreaData();
                }}
                onBulkAddSteps={async (titles) => {
                  await bulkAddSteps.mutateAsync({
                    id: goal.id,
                    data: { titles },
                  });
                  invalidateAreaData();
                  toast({
                    title: titles.length === 1 ? "Step added" : `${titles.length} steps added`,
                  });
                }}
                onReorderSteps={async (taskIds) => {
                  try {
                    await reorderSteps.mutateAsync({ id: goal.id, data: { taskIds } });
                    invalidateAreaData();
                  } catch {
                    toast({ title: "Couldn't save order.", variant: "destructive" });
                  }
                }}
                onToggleMode={async () => {
                  const nextMode = goal.mode === "ordered" ? "any" : "ordered";
                  await updateMilestone.mutateAsync({
                    id: goal.id,
                    data: { mode: nextMode },
                  });
                  invalidateAreaData();
                  toast({
                    title: nextMode === "ordered" ? "Step-by-step." : "Any order.",
                  });
                }}
                onDeleteGoal={async () => {
                  if (!window.confirm("Delete this goal? Steps under it become loose tasks.")) {
                    return;
                  }
                  try {
                    await deleteMilestone.mutateAsync({ id: goal.id });
                    invalidateAreaData();
                    toast({ title: "Goal deleted." });
                  } catch {
                    toast({ title: "Couldn't delete.", variant: "destructive" });
                  }
                }}
                onSetCompleted={async (completedAt) => {
                  try {
                    await updateMilestone.mutateAsync({
                      id: goal.id,
                      data: { completedAt },
                    });
                    invalidateAreaData();
                    toast({
                      title: completedAt ? "Goal complete." : "Goal reopened.",
                    });
                  } catch {
                    toast({
                      title: completedAt
                        ? "Couldn't mark complete."
                        : "Couldn't reopen.",
                      variant: "destructive",
                    });
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {/* INBOX — below goals. Unassigned tasks live here. */}
      <section
        aria-labelledby="inbox-heading"
        className="rounded-2xl bg-card border border-card-border p-4 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="inbox-heading" className="text-sm font-medium text-foreground">
            Inbox
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Drop anything here. Sort it later, or don't.
        </p>
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
          placeholder={"Dump it. One per line."}
          rows={Math.max(3, Math.min(8, draftLines.length + 1))}
          className="resize-y min-h-[88px]"
          aria-describedby="inbox-hint"
        />
        <div className="flex items-center justify-between gap-3">
          <p id="inbox-hint" className="text-xs text-muted-foreground">
            {draftLines.length === 0
              ? "Tip: Cmd/Ctrl+Enter to add."
              : `Adds ${draftLines.length} ${draftLines.length === 1 ? "task" : "tasks"}.`}
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

      {/* Unassigned — tasks not in a goal yet. */}
      <section aria-labelledby="unassigned-heading" className="space-y-2">
        <h2
          id="unassigned-heading"
          className="font-serif text-sm font-medium text-muted-foreground uppercase tracking-wide"
        >
          Unassigned ({looseTasks.length})
        </h2>
        <p className="text-xs text-muted-foreground">Tasks not in a goal yet.</p>
        {tasksQuery.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : looseTasks.length === 0 ? (
          <div className="rounded-2xl bg-card border border-card-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {tasks.length === 0
                ? "Nothing here yet. Start dumping."
                : "All grouped. Nice."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {looseTasks.map((task) => (
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

      {/* Recently closed */}
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

// ─────────────────────────────────────────────────────────────────────────
// Inline header editors (Phase 4).
// ─────────────────────────────────────────────────────────────────────────

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

/**
 * Soft, muted textarea for a private note on this area. Empty state is a
 * small placeholder; saved text shows muted above the goals section. Save
 * on blur. Empty is fine. Persists to the `honestNote` column.
 */
function AreaNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
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
        placeholder="Anything making this hard, or worth remembering. Just for you."
        rows={2}
        className="text-sm rounded-xl resize-none bg-muted/30 border-dashed"
        aria-label="Note"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="block w-full text-left rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
      aria-label={value ? "Edit note" : "Add a note"}
    >
      {value || (
        <span className="italic opacity-80">Anything making this hard, or worth remembering. Just for you.</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Goal card — collapsible, with steps, breakdown, mode toggle.
// ─────────────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: Milestone;
  tasks: Task[];
  onUpdateTask: (t: Task) => void;
  onAfterMutation: () => void;
  breakdownPending: boolean;
  onBreakdown: () => Promise<void>;
  onAddStep: (title: string) => Promise<void>;
  onBulkAddSteps: (titles: string[]) => Promise<void>;
  onReorderSteps: (taskIds: number[]) => Promise<void>;
  onToggleMode: () => Promise<void>;
  onDeleteGoal: () => Promise<void>;
  onSetCompleted: (completedAt: string | null) => Promise<void>;
}

function GoalCard({
  goal,
  tasks,
  onUpdateTask,
  breakdownPending,
  onBreakdown,
  onAddStep,
  onBulkAddSteps,
  onReorderSteps,
  onToggleMode,
  onDeleteGoal,
  onSetCompleted,
}: GoalCardProps) {
  const isComplete = !!goal.completedAt;
  // Default closed for completed goals — they collapse to a single line.
  const [open, setOpen] = useState(!isComplete);
  const [stepDraft, setStepDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Auto-collapse when a goal flips to complete (whether by manual toggle
  // or by the last step being checked). Re-expand when reopened.
  const prevCompleteRef = useRef(isComplete);
  useEffect(() => {
    if (prevCompleteRef.current !== isComplete) {
      setOpen(!isComplete);
      prevCompleteRef.current = isComplete;
    }
  }, [isComplete]);

  // Steps belonging to this goal: pending first (in their stored order),
  // then done at the bottom in their relative order. Sorting the
  // completed ones down keeps focus on what's left.
  const steps = useMemo(() => {
    const all = tasks
      .filter((t) => t.milestoneId === goal.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
    const pending = all.filter((s) => s.status !== "done");
    const done = all.filter((s) => s.status === "done");
    return [...pending, ...done];
  }, [tasks, goal.id]);

  const pendingSteps = steps.filter((s) => s.status === "pending");
  const doneCount = steps.filter((s) => s.status === "done").length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(steps, oldIndex, newIndex);
    void onReorderSteps(reordered.map((s) => s.id));
  };

  const handleAddStep = async () => {
    const title = stepDraft.trim();
    if (!title) return;
    setAdding(true);
    try {
      await onAddStep(title);
      setStepDraft("");
    } finally {
      setAdding(false);
    }
  };

  // For ordered goals: only the first pending step is "live" — later
  // pending steps are visually muted to mirror the briefing rule.
  const liveStepId = goal.mode === "ordered" ? pendingSteps[0]?.id ?? null : null;

  // Toggling a step: if this flip closes the last open step, also mark
  // the goal complete. Frontend drives this — the API stays simple.
  const handleStepToggle = (step: Task) => {
    onUpdateTask(step);
    if (
      step.status !== "done" &&
      pendingSteps.length === 1 &&
      pendingSteps[0]!.id === step.id &&
      !goal.completedAt
    ) {
      void onSetCompleted(new Date().toISOString());
    }
  };

  const handleManualToggleComplete = () => {
    void onSetCompleted(goal.completedAt ? null : new Date().toISOString());
  };

  // Collapsed view for a completed goal: a single muted line. Click expands.
  if (isComplete && !open) {
    return (
      <li className="rounded-2xl bg-card/60 border border-card-border overflow-hidden">
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            aria-expanded={false}
            aria-label={`Expand completed goal: ${goal.title}`}
          >
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-sm text-muted-foreground line-through truncate flex-1 min-w-0">
              {goal.title}
            </span>
            <span className="text-xs text-muted-foreground/80 flex-shrink-0">
              {steps.length} {steps.length === 1 ? "step" : "steps"}
            </span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleManualToggleComplete}
            aria-label={`Reopen goal: ${goal.title}`}
          >
            Reopen
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className={`rounded-2xl border border-card-border overflow-hidden ${
      isComplete ? "bg-card/60" : "bg-card"
    }`}>
      {/* Goal header row */}
      <div className="flex items-start justify-between gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-start gap-2 flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${
              isComplete ? "text-muted-foreground line-through" : "text-foreground"
            }`}>
              {goal.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {steps.length === 0
                ? "No steps yet."
                : `${doneCount} of ${steps.length} done${
                    goal.mode === "ordered" ? " · step-by-step" : " · any order"
                  }`}
            </p>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleManualToggleComplete}
          aria-label={isComplete ? `Reopen goal: ${goal.title}` : `Mark goal complete: ${goal.title}`}
        >
          {isComplete ? "Reopen" : "Mark complete"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => void onDeleteGoal()}
          aria-label="Delete goal"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-card-border/60 pt-3">
          {/* Mode toggle + breakdown */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void onToggleMode()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Mode: <span className="font-medium text-foreground">
                {goal.mode === "ordered" ? "Step-by-step" : "Any order"}
              </span>
              <span className="text-muted-foreground/60"> · tap to switch</span>
            </button>
            {steps.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-full"
                onClick={() => void onBreakdown()}
                disabled={breakdownPending}
              >
                <Wand2 className="h-3 w-3 mr-1" />
                {breakdownPending ? "Drafting…" : "Break this down"}
              </Button>
            )}
          </div>

          {/* Steps list */}
          {steps.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={steps.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1.5">
                  {steps.map((step) => (
                    <SortableStepRow
                      key={step.id}
                      step={step}
                      isLive={liveStepId === null || liveStepId === step.id}
                      onToggle={() => handleStepToggle(step)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {/* Add step */}
          <div className="flex gap-2">
            <Input
              value={stepDraft}
              onChange={(e) => setStepDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddStep();
                }
              }}
              placeholder="+ Add step"
              className="text-sm h-8"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full"
              onClick={() => void handleAddStep()}
              disabled={!stepDraft.trim() || adding}
            >
              Add
            </Button>
          </div>

          {/* Bulk-add: paste a list, parse, edit, save many. */}
          {bulkOpen ? (
            <BulkAddStepsPanel
              onCancel={() => setBulkOpen(false)}
              onSave={async (titles) => {
                await onBulkAddSteps(titles);
                setBulkOpen(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add several
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bulk-add steps panel — paste a list, parse on blur, edit rows, save all.
// ─────────────────────────────────────────────────────────────────────────

interface BulkAddStepsPanelProps {
  onCancel: () => void;
  onSave: (titles: string[]) => Promise<void>;
}

function BulkAddStepsPanel({ onCancel, onSave }: BulkAddStepsPanelProps) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const tooLong = (rows ?? []).some((r) => r.length > 280);
  const cleanRows = (rows ?? []).map((r) => r.trim()).filter((r) => r.length > 0);
  const saveDisabled = saving || cleanRows.length === 0 || tooLong;

  const handleParse = () => {
    const parsed = parseStepsPaste(raw);
    setRows(parsed);
  };

  const handleSave = async () => {
    if (cleanRows.length === 0 || tooLong) return;
    setSaving(true);
    try {
      await onSave(cleanRows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-card-border/60 bg-muted/20 p-3 space-y-2">
      {rows === null ? (
        <>
          <Textarea
            ref={textareaRef}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={handleParse}
            placeholder="Paste your list. One per line works best."
            rows={4}
            className="text-sm rounded-xl resize-y"
            aria-label="Paste steps"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Bullets, numbers, and commas all work.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full text-xs"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full text-xs"
                onClick={handleParse}
                disabled={raw.trim().length === 0}
              >
                Parse
              </Button>
            </div>
          </div>
        </>
      ) : rows.length === 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            Nothing to parse. Paste a list and try again.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-full text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs"
              onClick={() => setRows(null)}
            >
              Back to paste
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-1.5">
            {rows.map((row, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input
                  value={row}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = e.target.value;
                    setRows(next);
                  }}
                  className="text-sm h-8 rounded-xl"
                  aria-label={`Step ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  aria-label={`Remove step ${i + 1}`}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {tooLong && (
            <p className="text-xs text-destructive">
              One or more steps is too long. Trim to 280 characters.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRows(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to paste
            </button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 rounded-full text-xs"
                onClick={onCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-full text-xs"
                onClick={() => void handleSave()}
                disabled={saveDisabled}
              >
                {saving
                  ? "Saving…"
                  : `Save ${cleanRows.length} ${cleanRows.length === 1 ? "step" : "steps"}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SortableStepRowProps {
  step: Task;
  isLive: boolean;
  onToggle: () => void;
}

function SortableStepRow({ step, isLive, onToggle }: SortableStepRowProps) {
  const isDone = step.status === "done";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    disabled: isDone,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const muted = !isLive && !isDone;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl border border-card-border/60 px-2 py-1.5 ${
        isDone ? "bg-card/30 opacity-60" : muted ? "bg-card/40 opacity-60" : "bg-background"
      }`}
    >
      {isDone ? (
        <span
          className="flex-shrink-0 text-transparent"
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isDone ? `Reopen "${step.title}"` : `Mark "${step.title}" done`}
        aria-pressed={isDone}
        className={`h-4 w-4 rounded-full border transition-colors flex items-center justify-center flex-shrink-0 ${
          isDone
            ? "border-emerald-500/60 bg-emerald-500/15 hover:border-emerald-500"
            : "border-card-border hover:border-foreground"
        }`}
      >
        {isDone && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
      </button>
      <span
        className={`flex-1 min-w-0 text-sm truncate ${
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        }`}
      >
        {step.title}
      </span>
      {isLive && !isDone && (
        <span className="text-[10px] uppercase tracking-wide text-foreground/60 font-medium">
          Up next
        </span>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Loose-task row.
// ─────────────────────────────────────────────────────────────────────────

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
        />
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
