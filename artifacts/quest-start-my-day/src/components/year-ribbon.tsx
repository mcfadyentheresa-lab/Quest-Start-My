import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useGetYearRibbon,
  type YearRibbonResponse,
  type YearRibbonArea,
  type YearRibbonGoalBar,
  type YearRibbonWeek,
} from "@workspace/api-client-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const WEEKS = 52;
const CELL_W = 16;
const CELL_GAP = 2;
const ROW_H = 28;
const RAIL_W = 168;

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Date for the Monday-ish start of week index `i` in year `year`.
// (Approximate; week 0 starts Jan 1, week 1 = Jan 8, etc.)
function weekStartDate(year: number, weekIdx: number): Date {
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() + weekIdx * 7);
  return start;
}

function weekEndDate(year: number, weekIdx: number): Date {
  const end = weekStartDate(year, weekIdx);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

function formatRange(year: number, weekIdx: number): string {
  const s = weekStartDate(year, weekIdx);
  const e = weekEndDate(year, weekIdx);
  const startMonth = MONTH_LABELS[s.getUTCMonth()];
  const endMonth = MONTH_LABELS[e.getUTCMonth()];
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getUTCDate()}–${e.getUTCDate()}`;
  }
  return `${startMonth} ${s.getUTCDate()}–${endMonth} ${e.getUTCDate()}`;
}

// Map a week-index 0..51 to a month index 0..11 by its start date.
function monthForWeek(year: number, weekIdx: number): number {
  return weekStartDate(year, weekIdx).getUTCMonth();
}

function weekActivity(w: YearRibbonWeek): number {
  return w.completedTasks + w.closedSteps;
}

// Five intensity buckets (0..4). Tuned for typical weekly activity.
function intensityLevel(activity: number): 0 | 1 | 2 | 3 | 4 {
  if (activity <= 0) return 0;
  if (activity === 1) return 1;
  if (activity <= 3) return 2;
  if (activity <= 6) return 3;
  return 4;
}

function intensityClass(level: 0 | 1 | 2 | 3 | 4, future: boolean): string {
  if (future) return "bg-muted/30";
  switch (level) {
    case 0:
      return "bg-muted/50";
    case 1:
      return "bg-emerald-200/70 dark:bg-emerald-900/40";
    case 2:
      return "bg-emerald-300/80 dark:bg-emerald-800/60";
    case 3:
      return "bg-emerald-400 dark:bg-emerald-700/80";
    case 4:
      return "bg-emerald-500 dark:bg-emerald-500/90";
  }
}

function priorityChipClass(p: string): string {
  if (p === "P1") return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  if (p === "P2") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (p === "P3") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

// Color used to tint a goal bar. Falls back to a hash of the area id when
// the area has no explicit color.
function goalBarColor(area: YearRibbonArea): string {
  if (area.color) return area.color;
  const palette = ["#7d8a6f", "#8a6f7d", "#6f7d8a", "#a08a6f", "#6fa088", "#8a6fa0"];
  return palette[area.id % palette.length]!;
}

function YearRibbonHeader({
  year,
  onYear,
  onToday,
}: {
  year: number;
  onYear: (next: number) => void;
  onToday: () => void;
}) {
  const currentYear = new Date().getUTCFullYear();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onYear(year - 1)}
          aria-label="Previous year"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-lg font-semibold tabular-nums">{year}</div>
        <button
          type="button"
          onClick={() => onYear(year + 1)}
          aria-label="Next year"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="ml-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
          disabled={year === currentYear}
        >
          Today
        </button>
      </div>
      <YearRibbonLegend />
    </div>
  );
}

function YearRibbonLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Quiet</span>
      <div className="flex items-center gap-1">
        {([0, 1, 2, 3, 4] as const).map((lvl) => (
          <span
            key={lvl}
            className={`block h-3 w-3 rounded-sm ${intensityClass(lvl, false)}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>Busy</span>
    </div>
  );
}

function MonthAxis() {
  // Each label spans the weeks whose start date falls in that month.
  const groups = useMemo(() => {
    const arr: { month: string; start: number; end: number }[] = [];
    const year = new Date().getUTCFullYear();
    let curMonth = -1;
    let curStart = 0;
    for (let i = 0; i < WEEKS; i++) {
      const m = monthForWeek(year, i);
      if (m !== curMonth) {
        if (curMonth !== -1) {
          arr.push({ month: MONTH_LABELS[curMonth]!, start: curStart, end: i - 1 });
        }
        curMonth = m;
        curStart = i;
      }
    }
    arr.push({ month: MONTH_LABELS[curMonth]!, start: curStart, end: WEEKS - 1 });
    return arr;
  }, []);

  return (
    <div
      className="relative h-5 select-none"
      style={{ width: WEEKS * (CELL_W + CELL_GAP) }}
      aria-hidden="true"
    >
      {groups.map((g) => {
        const left = g.start * (CELL_W + CELL_GAP);
        const width = (g.end - g.start + 1) * (CELL_W + CELL_GAP);
        return (
          <span
            key={g.month}
            className="absolute top-0 text-[10px] uppercase tracking-wider text-muted-foreground"
            style={{ left, width }}
          >
            {g.month}
          </span>
        );
      })}
    </div>
  );
}

function GoalBar({
  bar,
  area,
}: {
  bar: YearRibbonGoalBar;
  area: YearRibbonArea;
}) {
  const left = bar.startWeek * (CELL_W + CELL_GAP);
  const width =
    (bar.endWeek - bar.startWeek + 1) * (CELL_W + CELL_GAP) - CELL_GAP;
  const color = goalBarColor(area);
  const stepCount = bar.endWeek - bar.startWeek + 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute top-1 h-3 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          style={{ left, width, backgroundColor: color }}
          aria-label={`Goal: ${bar.title}`}
          data-testid={`goal-bar-${bar.goalId}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        <div className="space-y-1.5">
          <div className="font-medium leading-tight">{bar.title}</div>
          <div className="text-xs text-muted-foreground">
            {bar.isOnHold ? "On hold" : bar.status}
            {" · "}
            {stepCount} {stepCount === 1 ? "week" : "weeks"} of activity
          </div>
          <Link
            href={`/areas/${area.id}#goal-${bar.goalId}`}
            className="block pt-1 text-xs font-medium text-primary hover:underline"
          >
            Open in {area.name}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AreaRow({
  area,
  year,
  todayWeekIndex,
}: {
  area: YearRibbonArea;
  year: number;
  todayWeekIndex: number | null;
}) {
  const [, navigate] = useLocation();
  const todayYear = new Date().getUTCFullYear();
  const todayWeek = year === todayYear ? todayWeekIndex : null;

  return (
    <div className="flex items-stretch border-t border-border/40">
      <div
        className="flex shrink-0 items-center gap-2 pr-3"
        style={{ width: RAIL_W, height: ROW_H }}
      >
        <Link
          href={`/areas/${area.id}`}
          className="truncate text-xs font-medium text-foreground hover:underline"
          title={area.name}
        >
          {area.name}
        </Link>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${priorityChipClass(area.priority)}`}
        >
          {area.priority}
        </span>
      </div>
      <div
        className="relative"
        style={{ width: WEEKS * (CELL_W + CELL_GAP), height: ROW_H }}
      >
        {area.weeks.map((w) => {
          const future =
            todayWeek !== null && w.index > todayWeek;
          const isToday = todayWeek !== null && w.index === todayWeek;
          const level = intensityLevel(weekActivity(w));
          const left = w.index * (CELL_W + CELL_GAP);
          const tooltip = `${formatRange(year, w.index)} · ${w.completedTasks} done · ${w.closedSteps} steps`;
          const target = ymd(weekStartDate(year, w.index));
          return (
            <Tooltip key={w.index}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate(`/calendar?view=week&date=${target}`)}
                  aria-label={tooltip}
                  data-testid={`year-cell-${area.id}-${w.index}`}
                  data-future={future ? "true" : "false"}
                  data-today={isToday ? "true" : "false"}
                  className={`absolute rounded-sm transition-colors ${intensityClass(level, future)} ${isToday ? "ring-1 ring-foreground/70" : ""}`}
                  style={{
                    top: 6,
                    left,
                    width: CELL_W,
                    height: ROW_H - 12,
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="text-xs">{tooltip}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {area.goalBars.map((bar) => (
          <GoalBar key={bar.goalId} bar={bar} area={area} />
        ))}
      </div>
    </div>
  );
}

export function YearRibbonView({
  data,
  year,
  onYear,
  onToday,
}: {
  data: YearRibbonResponse;
  year: number;
  onYear: (next: number) => void;
  onToday: () => void;
}) {
  if (data.areas.length === 0) {
    return (
      <div className="space-y-4">
        <YearRibbonHeader year={year} onYear={onYear} onToday={onToday} />
        <EmptyState reason="no-areas" />
      </div>
    );
  }

  const totalActivity = data.areas.reduce(
    (sum, a) => sum + a.weeks.reduce((s, w) => s + weekActivity(w), 0),
    0,
  );

  return (
    <div className="space-y-3">
      <YearRibbonHeader year={year} onYear={onYear} onToday={onToday} />
      {totalActivity === 0 ? (
        <EmptyState reason="quiet-year" />
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="rounded-2xl border border-card-border bg-card p-3">
            <div className="overflow-x-auto">
              <div
                className="flex flex-col"
                style={{ minWidth: RAIL_W + WEEKS * (CELL_W + CELL_GAP) }}
              >
                <div className="flex items-end pb-1">
                  <div className="shrink-0" style={{ width: RAIL_W }} />
                  <MonthAxis />
                </div>
                {data.areas.map((area) => (
                  <AreaRow
                    key={area.id}
                    area={area}
                    year={year}
                    todayWeekIndex={data.todayWeekIndex}
                  />
                ))}
              </div>
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

function EmptyState({ reason }: { reason: "no-areas" | "quiet-year" }) {
  const message =
    reason === "no-areas"
      ? "No areas yet. Set up a few areas, mark them active, then come back."
      : "Quiet year so far. Mark areas active, complete a few tasks, then come back.";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Link
        href="/areas"
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        Open areas
      </Link>
    </div>
  );
}

export function YearRibbonSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="rounded-2xl border border-card-border bg-card p-3">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function YearRibbonError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
      <p className="text-sm text-destructive">The year ribbon could not load.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        Try again
      </button>
    </div>
  );
}

export default function YearRibbon() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const fallback = new Date().getUTCFullYear();
  const initialYear = (() => {
    const raw = params.get("year");
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 1970 && n <= 9999 ? n : fallback;
  })();

  const [year, setYearState] = useState(initialYear);
  const { data, isLoading, isError, refetch } = useGetYearRibbon(year);

  const onYear = (next: number) => setYearState(next);
  const onToday = () => setYearState(new Date().getUTCFullYear());

  if (isLoading) return <YearRibbonSkeleton />;
  if (isError || !data) return <YearRibbonError onRetry={() => refetch()} />;

  return (
    <YearRibbonView
      data={data}
      year={year}
      onYear={onYear}
      onToday={onToday}
      key={year}
    />
  );
}
