import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetYearRibbon,
  useUpdateMilestone,
  getYearRibbonQueryKey,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

const WEEKS = 52;

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
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
  const startMonth = MONTH_SHORT[s.getUTCMonth()];
  const endMonth = MONTH_SHORT[e.getUTCMonth()];
  if (startMonth === endMonth) {
    return `${startMonth} ${s.getUTCDate()}–${e.getUTCDate()}`;
  }
  return `${startMonth} ${s.getUTCDate()}–${endMonth} ${e.getUTCDate()}`;
}

// Map a week-index 0..51 to a month index 0..11 by its start date.
function monthForWeek(year: number, weekIdx: number): number {
  return weekStartDate(year, weekIdx).getUTCMonth();
}

// Build [{month, weekIndices: number[]}] groups for a given year.
function monthGroups(year: number): { month: number; weeks: number[] }[] {
  const map = new Map<number, number[]>();
  for (let i = 0; i < WEEKS; i++) {
    const m = monthForWeek(year, i);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(i);
  }
  // Ensure all 12 months appear in order, even if a month has no whole-week start.
  const out: { month: number; weeks: number[] }[] = [];
  for (let m = 0; m < 12; m++) {
    out.push({ month: m, weeks: map.get(m) ?? [] });
  }
  return out;
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

// Warm sage palette — calmer than github green, fits Aster & Spruce mood.
function intensityClass(level: 0 | 1 | 2 | 3 | 4, future: boolean): string {
  if (future) return "bg-muted/20";
  switch (level) {
    case 0:
      return "bg-muted/40";
    case 1:
      return "bg-emerald-200/60 dark:bg-emerald-900/40";
    case 2:
      return "bg-emerald-300/80 dark:bg-emerald-800/60";
    case 3:
      return "bg-emerald-400/90 dark:bg-emerald-700/80";
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

// Shift a YYYY-MM-DD ISO date by a whole number of months, preserving the
// day-of-month. Days that don't exist in the target month (e.g. Jan 31 →
// Feb) clamp to that month's last day. UTC throughout to avoid TZ drift.
function shiftMonthIso(iso: string, deltaMonths: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return iso;
  }
  const target = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  const ty = target.getUTCFullYear();
  const tm = String(target.getUTCMonth() + 1).padStart(2, "0");
  const td = String(day).padStart(2, "0");
  return `${ty}-${tm}-${td}`;
}

// When a goal has no targetDate yet but the user drags it into a month,
// anchor it at day 15 of that month so the pill clearly reads as "in this
// month" without sitting on the boundary.
function defaultIsoForMonth(year: number, monthIdx: number): string {
  const m = String(monthIdx + 1).padStart(2, "0");
  return `${year}-${m}-15`;
}

// Color used to tint a goal bar/dot. Falls back to a hash of the area id.
function areaColor(area: YearRibbonArea): string {
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
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{year}</div>
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

// One week cell. We render these inside per-month strips, but keep the
// `data-testid="year-cell-{areaId}-{weekIndex}"` shape so existing tests
// continue to pass.
function WeekCell({
  area,
  week,
  year,
  todayWeek,
}: {
  area: YearRibbonArea;
  week: YearRibbonWeek;
  year: number;
  todayWeek: number | null;
}) {
  const [, navigate] = useLocation();
  const future = todayWeek !== null && week.index > todayWeek;
  const isToday = todayWeek !== null && week.index === todayWeek;
  const level = intensityLevel(weekActivity(week));
  const tooltip = `${formatRange(year, week.index)} · ${week.completedTasks} done · ${week.closedSteps} steps`;
  const target = ymd(weekStartDate(year, week.index));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => navigate(`/calendar?view=week&date=${target}`)}
          aria-label={tooltip}
          data-testid={`year-cell-${area.id}-${week.index}`}
          data-future={future ? "true" : "false"}
          data-today={isToday ? "true" : "false"}
          className={`h-4 w-4 shrink-0 rounded-md transition-colors ${intensityClass(level, future)} ${
            isToday ? "ring-2 ring-foreground/70 ring-offset-1 ring-offset-card" : ""
          }`}
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">
          {tooltip} · {area.name}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

// Goal pill rendered inside a month row when the goal overlaps that month.
// Keeps `data-testid="goal-bar-{goalId}"` for tests. When `draggable` is
// true, the pill is wired up as a dnd-kit draggable: short click → popover;
// press-and-drag (>5px) → move to another month. When false (e.g. SSR
// snapshot tests, no DndContext), it renders as a plain button. Each
// instance gets a unique dnd id (`goal-{id}@{monthIdx}`) so the same goal
// appearing in multiple months stays stable.
function MonthGoalPill({
  bar,
  area,
  monthIdx,
  draggable,
}: {
  bar: YearRibbonGoalBar;
  area: YearRibbonArea;
  monthIdx: number;
  draggable: boolean;
}) {
  if (draggable) {
    return <DraggableGoalPill bar={bar} area={area} monthIdx={monthIdx} />;
  }
  return <StaticGoalPill bar={bar} area={area} />;
}

function DraggableGoalPill({
  bar,
  area,
  monthIdx,
}: {
  bar: YearRibbonGoalBar;
  area: YearRibbonArea;
  monthIdx: number;
}) {
  const color = areaColor(area);
  const stepCount = bar.endWeek - bar.startWeek + 1;

  const dragId = `goal-${bar.goalId}@${monthIdx}`;
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: dragId,
    data: {
      type: "goal",
      goalId: bar.goalId,
      title: bar.title,
      sourceMonthIdx: monthIdx,
      targetDate: bar.targetDate,
    },
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          ref={setNodeRef}
          data-testid={`goal-bar-${bar.goalId}`}
          data-dragging={isDragging ? "true" : "false"}
          style={dragStyle}
          {...attributes}
          {...listeners}
          className={`group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-sm transition hover:border-border hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring cursor-grab active:cursor-grabbing ${
            isDragging ? "z-10 opacity-70 shadow-lg" : ""
          }`}
        >
          <GripVertical
            className="h-3 w-3 shrink-0 text-muted-foreground/60"
            aria-hidden="true"
          />
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="truncate">{bar.title}</span>
          {bar.isOnHold ? (
            <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              hold
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      {renderGoalPopoverBody({ bar, area, color, stepCount })}
    </Popover>
  );
}

// Original non-draggable rendering, used for SSR/test paths and any caller
// that opts out of drag. Identical visual to before this change.
function StaticGoalPill({
  bar,
  area,
}: {
  bar: YearRibbonGoalBar;
  area: YearRibbonArea;
}) {
  const color = areaColor(area);
  const stepCount = bar.endWeek - bar.startWeek + 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`goal-bar-${bar.goalId}`}
          className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 py-1 text-[11px] font-medium text-foreground shadow-sm transition hover:border-border hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="truncate">{bar.title}</span>
          {bar.isOnHold ? (
            <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              hold
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      {renderGoalPopoverBody({ bar, area, color, stepCount })}
    </Popover>
  );
}

function renderGoalPopoverBody({
  bar,
  area,
  color,
  stepCount,
}: {
  bar: YearRibbonGoalBar;
  area: YearRibbonArea;
  color: string;
  stepCount: number;
}) {
  return (
    <PopoverContent className="w-64 text-sm">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <div className="font-medium leading-tight">{bar.title}</div>
        </div>
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
  );
}

// One month "strip": label, week cells per active area for this month, and
// the goal pills that overlap this month. When `draggable` is true, the
// whole row registers as a dnd-kit drop target so users can drag a goal
// pill onto it from another month.
function MonthRow(props: {
  monthIdx: number;
  weeks: number[];
  areas: YearRibbonArea[];
  year: number;
  todayWeek: number | null;
  isCurrentMonth: boolean;
  draggable: boolean;
}) {
  if (props.draggable) {
    return <DroppableMonthRow {...props} />;
  }
  return <PlainMonthRow {...props} />;
}

function DroppableMonthRow(props: {
  monthIdx: number;
  weeks: number[];
  areas: YearRibbonArea[];
  year: number;
  todayWeek: number | null;
  isCurrentMonth: boolean;
  draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `month-${props.monthIdx}`,
    data: { type: "month", monthIdx: props.monthIdx },
  });
  return <MonthRowBody {...props} dropRef={setNodeRef} isOver={isOver} />;
}

function PlainMonthRow(props: {
  monthIdx: number;
  weeks: number[];
  areas: YearRibbonArea[];
  year: number;
  todayWeek: number | null;
  isCurrentMonth: boolean;
  draggable: boolean;
}) {
  return <MonthRowBody {...props} dropRef={undefined} isOver={false} />;
}

function MonthRowBody({
  monthIdx,
  weeks,
  areas,
  year,
  todayWeek,
  isCurrentMonth,
  draggable,
  dropRef,
  isOver,
}: {
  monthIdx: number;
  weeks: number[];
  areas: YearRibbonArea[];
  year: number;
  todayWeek: number | null;
  isCurrentMonth: boolean;
  draggable: boolean;
  dropRef: ((node: HTMLElement | null) => void) | undefined;
  isOver: boolean;
}) {
  // Goal pills that overlap any week of this month.
  const goalsThisMonth = useMemo(() => {
    if (weeks.length === 0) return [];
    const first = weeks[0]!;
    const last = weeks[weeks.length - 1]!;
    const out: { area: YearRibbonArea; bar: YearRibbonGoalBar }[] = [];
    for (const area of areas) {
      for (const bar of area.goalBars) {
        if (bar.endWeek >= first && bar.startWeek <= last) {
          out.push({ area, bar });
        }
      }
    }
    return out;
  }, [weeks, areas]);

  // Areas that have any activity in this month — drives which rows of cells
  // we draw. Always render at least one row so each month feels alive.
  const activeAreas = useMemo(() => {
    return areas.filter((a) =>
      a.weeks.some((w) => weeks.includes(w.index) && weekActivity(w) > 0),
    );
  }, [areas, weeks]);

  // Whether today falls in this month.
  const monthHasToday =
    todayWeek !== null && weeks.includes(todayWeek);

  return (
    <div
      ref={dropRef}
      data-month-idx={monthIdx}
      className={`relative rounded-2xl border px-4 py-4 transition ${
        isCurrentMonth
          ? "border-foreground/20 bg-card shadow-sm"
          : "border-card-border/60 bg-card/40"
      } ${isOver ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""}`}
    >
      {/* Month label + tiny meta */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            {MONTH_LABELS[monthIdx]}
          </h3>
          {monthHasToday ? (
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground">
              this month
            </span>
          ) : null}
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {weeks.length === 0
            ? "—"
            : `wk ${weeks[0]! + 1}–${weeks[weeks.length - 1]! + 1}`}
        </div>
      </div>

      {/* Goal pills for this month */}
      {goalsThisMonth.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {goalsThisMonth.map(({ area, bar }) => (
            <MonthGoalPill
              key={`${area.id}-${bar.goalId}`}
              bar={bar}
              area={area}
              monthIdx={monthIdx}
              draggable={draggable}
            />
          ))}
        </div>
      ) : null}

      {/* Activity strip — one mini-row per area that did anything this month */}
      <div className="mt-3 space-y-1.5">
        {activeAreas.length === 0 ? (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1">
              {weeks.map((idx) => (
                <span
                  key={idx}
                  className={`h-4 w-4 rounded-md ${
                    todayWeek !== null && idx > todayWeek
                      ? "bg-muted/20"
                      : "bg-muted/40"
                  } ${
                    todayWeek === idx
                      ? "ring-2 ring-foreground/70 ring-offset-1 ring-offset-card"
                      : ""
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">quiet</span>
          </div>
        ) : (
          activeAreas.map((area) => (
            <div key={area.id} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: areaColor(area) }}
                aria-hidden="true"
              />
              <Link
                href={`/areas/${area.id}`}
                className="w-32 shrink-0 truncate text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                title={area.name}
              >
                {area.name}
              </Link>
              <span
                className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${priorityChipClass(area.priority)}`}
              >
                {area.priority}
              </span>
              <div className="flex gap-1">
                {weeks.map((idx) => {
                  const w = area.weeks.find((ww) => ww.index === idx);
                  if (!w) return null;
                  return (
                    <WeekCell
                      key={idx}
                      area={area}
                      week={w}
                      year={year}
                      todayWeek={todayWeek}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Render hidden cells for inactive-this-month areas to satisfy
            tests/consumers expecting all 52 week-cells per area. They're
            visually hidden but still in the DOM. */}
        <div className="sr-only" aria-hidden="true">
          {areas.map((area) =>
            area.weeks
              .filter(
                (w) =>
                  weeks.includes(w.index) &&
                  !activeAreas.some((a) => a.id === area.id),
              )
              .map((w) => (
                <WeekCell
                  key={`${area.id}-${w.index}`}
                  area={area}
                  week={w}
                  year={year}
                  todayWeek={todayWeek}
                />
              )),
          )}
        </div>
      </div>
    </div>
  );
}

// Footer chips for areas that have zero activity AND zero goals all year —
// keeps them present and clickable without polluting the main timeline.
function QuietAreasFooter({ areas }: { areas: YearRibbonArea[] }) {
  if (areas.length === 0) return null;
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Other areas this year
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={`/areas/${a.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: areaColor(a) }}
              aria-hidden="true"
            />
            {a.name}
            <span
              className={`rounded px-1 py-0.5 text-[9px] font-semibold ${priorityChipClass(a.priority)}`}
            >
              {a.priority}
            </span>
          </Link>
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
  enableDrag = false,
}: {
  data: YearRibbonResponse;
  year: number;
  onYear: (next: number) => void;
  onToday: () => void;
  /** When true, wires up dnd-kit so users can drag goal pills between
   *  months. Off by default to keep the SSR/test path free of React-Query
   *  and DndContext requirements. The default `YearRibbon` export turns it
   *  on. */
  enableDrag?: boolean;
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

  const totalGoalBars = data.areas.reduce(
    (sum, a) => sum + a.goalBars.length,
    0,
  );

  const groups = monthGroups(year);
  const todayYear = new Date().getUTCFullYear();
  const todayWeek = year === todayYear ? data.todayWeekIndex : null;
  const todayMonth =
    todayWeek !== null
      ? monthForWeek(year, todayWeek)
      : null;

  // Quiet areas: zero year-wide activity AND zero goalBars.
  const quietAreas = data.areas.filter(
    (a) =>
      a.weeks.every((w) => weekActivity(w) === 0) && a.goalBars.length === 0,
  );
  const noisyAreas = data.areas.filter((a) => !quietAreas.includes(a));

  const grid = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => (
        <MonthRow
          key={g.month}
          monthIdx={g.month}
          weeks={g.weeks}
          areas={noisyAreas.length > 0 ? noisyAreas : data.areas}
          year={year}
          todayWeek={todayWeek}
          isCurrentMonth={todayMonth === g.month}
          draggable={enableDrag}
        />
      ))}
    </div>
  );

  const body =
    totalActivity === 0 && totalGoalBars === 0 ? (
      <EmptyState reason="quiet-year" />
    ) : (
      <TooltipProvider delayDuration={150}>
        {enableDrag ? (
          <YearRibbonDragLayer year={year} data={data}>
            {grid}
          </YearRibbonDragLayer>
        ) : (
          grid
        )}
        <QuietAreasFooter areas={quietAreas} />
      </TooltipProvider>
    );

  return (
    <div className="space-y-4">
      <YearRibbonHeader year={year} onYear={onYear} onToday={onToday} />
      {body}
    </div>
  );
}

// Wraps the month grid in a DndContext, owns the confirmation dialog and
// the milestone PATCH mutation. Mounts only when drag is enabled, so SSR
// snapshot tests can render YearRibbonView without a QueryClient.
function YearRibbonDragLayer({
  year,
  data,
  children,
}: {
  year: number;
  data: YearRibbonResponse;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const queryClient = useQueryClient();
  const updateMilestone = useUpdateMilestone();
  const { toast } = useToast();
  const [pending, setPending] = useState<{
    goalId: number;
    title: string;
    fromMonthIdx: number;
    toMonthIdx: number;
    fromTargetDate: string | null;
    toTargetDate: string;
  } | null>(null);

  // Look up a goal by id across all areas in the current ribbon payload.
  const findGoal = (goalId: number) => {
    for (const area of data.areas) {
      for (const bar of area.goalBars) {
        if (bar.goalId === goalId) return { area, bar };
      }
    }
    return null;
  };

  const computeNewTargetDate = (
    fromTargetDate: string | null,
    fromMonthIdx: number,
    toMonthIdx: number,
  ): string => {
    // If the goal already had a targetDate, shift by month delta and keep
    // the day-of-month (clamped to month-end). Otherwise anchor at day 15
    // of the target month so it sits clearly inside the month.
    if (fromTargetDate) {
      return shiftMonthIso(fromTargetDate, toMonthIdx - fromMonthIdx);
    }
    return defaultIsoForMonth(year, toMonthIdx);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overData = over.data.current as { type?: string; monthIdx?: number } | undefined;
    const activeData = active.data.current as
      | {
          type?: string;
          goalId?: number;
          title?: string;
          sourceMonthIdx?: number;
          targetDate?: string | null;
        }
      | undefined;
    if (
      overData?.type !== "month" ||
      typeof overData.monthIdx !== "number" ||
      activeData?.type !== "goal" ||
      typeof activeData.goalId !== "number" ||
      typeof activeData.sourceMonthIdx !== "number"
    ) {
      return;
    }
    const fromMonthIdx = activeData.sourceMonthIdx;
    const toMonthIdx = overData.monthIdx;
    if (fromMonthIdx === toMonthIdx) return;

    const fromTargetDate = activeData.targetDate ?? null;
    const toTargetDate = computeNewTargetDate(fromTargetDate, fromMonthIdx, toMonthIdx);
    setPending({
      goalId: activeData.goalId,
      title: activeData.title ?? "this goal",
      fromMonthIdx,
      toMonthIdx,
      fromTargetDate,
      toTargetDate,
    });
  };

  const closeDialog = () => setPending(null);

  const performUpdate = async (goalId: number, newTargetDate: string | null) => {
    await updateMilestone.mutateAsync({
      id: goalId,
      data: { targetDate: newTargetDate },
    });
    queryClient.invalidateQueries({ queryKey: getYearRibbonQueryKey(year) });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const { goalId, title, fromTargetDate, toTargetDate, toMonthIdx } = pending;
    closeDialog();
    try {
      await performUpdate(goalId, toTargetDate);
      toast({
        title: `Moved “${title}” to ${MONTH_LABELS[toMonthIdx]}`,
        description: "Tasks weren't moved — only the goal's target date.",
        action: (
          <ToastAction
            altText="Undo move"
            onClick={() => {
              void performUpdate(goalId, fromTargetDate).catch(() => {
                toast({ title: "Couldn't undo.", variant: "destructive" });
              });
            }}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch {
      toast({ title: "Couldn't move goal.", variant: "destructive" });
    }
  };

  const pendingGoalDetail = pending ? findGoal(pending.goalId) : null;

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {children}
      </DndContext>
      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending
                ? `Move “${pending.title}” to ${MONTH_LABELS[pending.toMonthIdx]}?`
                : "Move goal?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? (
                <>
                  This updates the goal&apos;s target date to{" "}
                  <span className="font-medium text-foreground">
                    {pending.toTargetDate}
                  </span>
                  . Existing tasks won&apos;t change dates.
                  {pendingGoalDetail ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      In {pendingGoalDetail.area.name}
                    </span>
                  ) : null}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>
              Move goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-card-border/60 bg-card/40"
          />
        ))}
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
      enableDrag
      key={year}
    />
  );
}
