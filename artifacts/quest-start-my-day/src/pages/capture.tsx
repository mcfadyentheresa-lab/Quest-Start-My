/**
 * Capture — the trust layer.
 *
 * One flat page that lets the user see *every* task they've ever
 * captured, search across them, and triage the unprocessed ones. Three
 * sub-tabs map to mental modes:
 *
 *   - Unprocessed: things waiting on a decision (no date OR AI flagged
 *     for review). This is what replaces the old /inbox triage screen.
 *   - All tasks: a flat, searchable archive. The "I'm sure I wrote that
 *     down somewhere" view.
 *   - Completed: a quiet record of the work that got done.
 *
 * Search is debounced 200ms and runs against title + whyItMatters +
 * doneLooksLike + originalDump. "/" focuses the search box from
 * anywhere on the page.
 *
 * Filters are simple chips (energy, area).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Search,
  Inbox as InboxIcon,
  ListChecks,
  CheckCircle2,
  X as XIcon,
  Loader2,
  CalendarPlus,
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  useSearchTasks,
  useListAreas,
  useUpdateTask,
  useDeleteTask,
  getSearchTasksQueryKey,
  getGetTaskInboxQueryKey,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  type Task,
  type Area,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TaskDetailSheet } from "@/components/task-detail-sheet";

type Bucket = "unprocessed" | "all" | "completed";

const TABS: { value: Bucket; label: string; Icon: typeof InboxIcon; help: string }[] = [
  {
    value: "unprocessed",
    label: "Unprocessed",
    Icon: InboxIcon,
    help: "Brain-dumps without a date, plus anything AI flagged for review.",
  },
  {
    value: "all",
    label: "All tasks",
    Icon: ListChecks,
    help: "Everything you've ever captured \u2014 newest first.",
  },
  {
    value: "completed",
    label: "Completed",
    Icon: CheckCircle2,
    help: "A quiet record of what got done.",
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatAge(createdAt: string): string {
  const created = new Date(createdAt);
  const diffMs = Date.now() - created.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 2) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.round(diffMo / 12)}y ago`;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

export default function CapturePage() {
  const [bucket, setBucket] = useState<Bucket>("unprocessed");
  const [rawQuery, setRawQuery] = useState("");
  const [areaFilter, setAreaFilter] = useState<number | null>(null);
  const [energyFilter, setEnergyFilter] = useState<
    "quick" | "medium" | "deep" | null
  >(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const debouncedQuery = useDebounced(rawQuery, 200);

  const { data: areas } = useListAreas();
  const params = useMemo(
    () => ({
      bucket,
      ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
      ...(areaFilter != null ? { areaId: areaFilter } : {}),
      ...(energyFilter != null ? { energy: energyFilter } : {}),
    }),
    [bucket, debouncedQuery, areaFilter, energyFilter],
  );
  const { data: tasks, isLoading, isError, refetch } = useSearchTasks(params);

  const areaMap = useMemo(() => {
    const m = new Map<number, Area>();
    for (const a of areas ?? []) m.set(a.id, a);
    return m;
  }, [areas]);

  // "/" focuses the search box. Skip when the user is already typing in
  // a text field so we don't steal their keystroke.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const visibleTasks = tasks ?? [];

  return (
    <div className="space-y-5 pb-32" data-testid="capture-page">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl font-medium text-foreground">Capture</h1>
        <p className="text-sm text-muted-foreground">
          Everything you've ever written down, in one searchable place.
        </p>
      </header>

      {/* Tabs */}
      <div
        className="flex items-stretch gap-1 rounded-xl bg-muted/30 p-1 border border-border"
        role="tablist"
        aria-label="Capture views"
      >
        {TABS.map(({ value, label, Icon }) => {
          const active = bucket === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`capture-tab-${value}`}
              onClick={() => setBucket(value)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchInputRef}
          type="search"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search tasks \u2014 press /  to jump here"
          className="pl-9 pr-9 rounded-xl"
          data-testid="capture-search"
          aria-label="Search tasks"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => setRawQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Clear search"
            data-testid="capture-search-clear"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Energy filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Energy:</span>
        {([
          { value: "quick", label: "Quick" },
          { value: "medium", label: "Medium" },
          { value: "deep", label: "Deep" },
        ] as const).map(({ value, label }) => {
          const active = energyFilter === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setEnergyFilter(active ? null : value)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? "border-foreground/40 bg-foreground/5 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`capture-energy-chip-${value}`}
            >
              {label}
            </button>
          );
        })}
        {energyFilter != null && (
          <button
            type="button"
            onClick={() => setEnergyFilter(null)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            data-testid="capture-energy-chip-clear"
          >
            Clear
          </button>
        )}
      </div>

      {/* Area filter chips */}
      {areas && areas.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Area:</span>
          <button
            type="button"
            onClick={() => setAreaFilter(null)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
              areaFilter == null
                ? "border-foreground/40 bg-foreground/5 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
            data-testid="capture-area-chip-all"
          >
            All
          </button>
          {areas.map((a) => {
            const active = areaFilter === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAreaFilter(active ? null : a.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                  active
                    ? "border-foreground/40 bg-foreground/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`capture-area-chip-${a.id}`}
              >
                {a.color && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                )}
                {a.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3" data-testid="capture-loading">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">Couldn't load tasks.</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-xl mt-2"
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState bucket={bucket} hasQuery={!!debouncedQuery.trim()} />
      ) : (
        <ul className="space-y-2" data-testid="capture-results">
          {visibleTasks.map((task) => (
            <CaptureRow
              key={task.id}
              task={task}
              area={task.areaId != null ? areaMap.get(task.areaId) ?? null : null}
              bucket={bucket}
              onOpen={() => setActiveTask(task)}
            />
          ))}
        </ul>
      )}

      {activeTask && (
        <TaskDetailSheet
          task={activeTask}
          open={true}
          onOpenChange={(open) => {
            if (!open) setActiveTask(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ bucket, hasQuery }: { bucket: Bucket; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="text-center py-12 rounded-2xl bg-card border border-dashed border-border">
        <p className="text-sm font-medium text-foreground">No matches</p>
        <p className="text-xs text-muted-foreground mt-1">
          Try a different word, or clear the search to see everything.
        </p>
      </div>
    );
  }
  const copy: Record<Bucket, { title: string; body: string }> = {
    unprocessed: {
      title: "Inbox empty",
      body: "Captured ideas without a date land here. Capture something using the button at the bottom-right.",
    },
    all: {
      title: "Nothing captured yet",
      body: "Tap the Capture button at the bottom-right to add your first thought.",
    },
    completed: {
      title: "Nothing finished yet",
      body: "Tasks you mark done show up here so you can see your week at a glance.",
    },
  };
  const c = copy[bucket];
  return (
    <div className="text-center py-12 rounded-2xl bg-card border border-dashed border-border">
      <p className="text-sm font-medium text-foreground">{c.title}</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">{c.body}</p>
      <Link href="/today">
        <Button size="sm" variant="ghost" className="rounded-xl">
          Back to today <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

interface RowProps {
  task: Task;
  area: Area | null;
  bucket: Bucket;
  onOpen: () => void;
}

function CaptureRow({ task, area, bucket, onOpen }: RowProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getSearchTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskInboxQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const scheduleToday = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await updateTask.mutateAsync({ id: task.id, data: { date: todayIso() } });
      invalidate();
      toast({ title: "Added to today." });
    } catch {
      toast({ title: "Couldn't schedule task.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setBusy(true);
    try {
      await deleteTask.mutateAsync({ id: task.id });
      invalidate();
    } catch {
      toast({ title: "Couldn't delete task.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const isUndated = !task.date;
  const isDone = task.status === "done";

  return (
    <li
      data-testid={`capture-row-${task.id}`}
      className="rounded-2xl border border-border bg-card hover:border-foreground/20 transition-colors"
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left px-4 py-3"
        aria-label={`Open task: ${task.title}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium leading-snug ${
                isDone ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </p>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {area && (
                <span className="inline-flex items-center gap-1">
                  {area.color && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: area.color }}
                    />
                  )}
                  {area.name}
                </span>
              )}
              {task.date && <span>{"\u2022"} {task.date}</span>}
              {!task.date && <span>{"\u2022"} no date</span>}
              {task.needsReview && (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {"\u2022"} needs review
                </span>
              )}
              <span className="text-muted-foreground/70">
                {"\u2022"} {formatAge(task.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </button>

      {bucket === "unprocessed" && isUndated && !isDone && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="rounded-xl text-xs h-8"
            onClick={scheduleToday}
            disabled={busy}
            data-testid={`capture-row-${task.id}-today`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Today"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-xs h-8"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            disabled={busy}
            data-testid={`capture-row-${task.id}-schedule`}
          >
            <CalendarPlus className="h-3.5 w-3.5 mr-1" />
            Schedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-xs h-8 text-muted-foreground hover:text-destructive ml-auto"
            onClick={remove}
            disabled={busy}
            aria-label="Delete task"
            data-testid={`capture-row-${task.id}-delete`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </li>
  );
}
