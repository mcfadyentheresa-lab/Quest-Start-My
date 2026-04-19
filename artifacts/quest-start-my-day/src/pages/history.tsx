import { useState, useMemo, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  useListProgressLogs,
  getListProgressLogsQueryKey,
  useGetWeekSummary,
  useGetPillarHealth,
  useGetDashboardSummary,
  useGetOutcomeMetrics,
  useGetFrictionSignals,
  getGetOutcomeMetricsQueryOptions,
} from "@workspace/api-client-react";
import { CategoryBadge } from "@/components/category-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, SkipForward, Pause, AlertCircle, History, TrendingUp, Layers, Clock,
  Activity, AlertTriangle, Info, ArrowDown, Target, BarChart2, Zap,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Repeat2, Ban, Timer, MinusCircle, ShieldCheck,
} from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusConfig: Record<string, { icon: React.ElementType; className: string; label: string }> = {
  done: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "Done" },
  pushed: { icon: SkipForward, className: "text-amber-600 dark:text-amber-400", label: "Pushed" },
  passed: { icon: Pause, className: "text-sky-600 dark:text-sky-400", label: "Passed" },
  blocked: { icon: AlertCircle, className: "text-rose-600 dark:text-rose-400", label: "Blocked" },
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
};

const unknownStatus = { icon: Clock, className: "text-muted-foreground", label: "Unknown" };

const portfolioStatusColors: Record<string, string> = {
  Active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  Warm: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  Parked: "text-muted-foreground bg-muted/50",
};

const frictionTypeConfig: Record<string, { icon: React.ElementType; label: string; iconClass: string; timeWindow: string }> = {
  repeated_pass: { icon: Repeat2, label: "Repeated pass", iconClass: "text-amber-500", timeWindow: "All time" },
  repeated_block: { icon: Ban, label: "Repeated block", iconClass: "text-rose-500", timeWindow: "All time" },
  stalled_milestone: { icon: Timer, label: "Stalled milestone", iconClass: "text-sky-500", timeWindow: "14 days before week end" },
  low_completion_ratio: { icon: MinusCircle, label: "Low completion", iconClass: "text-violet-500", timeWindow: "Calendar month of selected week" },
};

type Tab = "log" | "week" | "health" | "outcomes" | "friction";

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function shiftWeek(weekOf: string, delta: number): string {
  const d = new Date(weekOf + "T00:00:00");
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekOf: string): string {
  const start = new Date(weekOf + "T00:00:00");
  const end = new Date(weekOf + "T00:00:00");
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function getPastWeeks(count: number): string[] {
  const weeks: string[] = [];
  let current = getCurrentWeekStart();
  for (let i = 0; i < count; i++) {
    weeks.push(current);
    current = shiftWeek(current, -1);
  }
  return weeks;
}

function CollapsibleSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card border border-card-border overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-xs text-primary font-medium"
          >
            {open ? "Hide" : "Show detail"}
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
        <div className="mt-2">{summary}</div>
      </div>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border px-4 pb-4 pt-3 space-y-2"
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function PillarTrendIndicator({ rates }: { rates: number[] }) {
  if (rates.length < 2) return null;
  const current = rates[rates.length - 1];
  const prior = rates[rates.length - 2];
  const delta = current - prior;
  const threshold = 0.01;

  if (delta > threshold) {
    return (
      <span className="text-emerald-500 text-sm font-bold leading-none" title={`Up ${Math.round(delta * 100)}% vs prior week`}>
        ↑
      </span>
    );
  }
  if (delta < -threshold) {
    return (
      <span className="text-rose-500 text-sm font-bold leading-none" title={`Down ${Math.round(Math.abs(delta) * 100)}% vs prior week`}>
        ↓
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-sm font-bold leading-none" title="No change vs prior week">
      —
    </span>
  );
}

function PillarSparkline({ rates, weeks, selectedWeek }: { rates: number[]; weeks: string[]; selectedWeek?: string }) {
  const barCount = rates.length;
  const barWidth = 8;
  const barGap = 3;
  const maxH = 28;
  const svgW = barCount * barWidth + (barCount - 1) * barGap;

  const selectedIndex = selectedWeek ? weeks.indexOf(selectedWeek) : -1;
  const highlightIndex = selectedIndex !== -1 ? selectedIndex : barCount - 1;

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <svg width={svgW} height={maxH} className="overflow-visible">
        {rates.map((rate, i) => {
          const barH = Math.max(2, Math.round(rate * maxH));
          const x = i * (barWidth + barGap);
          const y = maxH - barH;
          const isHighlighted = i === highlightIndex;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                className={isHighlighted ? "fill-emerald-500" : "fill-muted-foreground/25"}
              />
              <title>{weeks[i] ? `Week of ${weeks[i]}: ${Math.round(rate * 100)}%` : `${Math.round(rate * 100)}%`}</title>
            </g>
          );
        })}
      </svg>
      <span className="text-[10px] text-muted-foreground leading-none">last {barCount}w</span>
    </div>
  );
}

function ProportionBar({
  segments,
}: {
  segments: { label: string; value: number; color: string; textColor: string; warning?: boolean }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {segments.map(seg => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${total > 0 ? (seg.value / total) * 100 : 100 / segments.length}%` }}
            title={`${seg.label}: ${Math.round(total > 0 ? (seg.value / total) * 100 : 0)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map(seg => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={seg.label} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${seg.color}`} />
              <span className={`text-xs font-medium ${seg.textColor}`}>{seg.label}</span>
              <span className="text-xs text-muted-foreground">{pct}%</span>
              {seg.warning && (
                <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  Higher than expected
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem("history_tab");
      if (saved === "log" || saved === "week" || saved === "health" || saved === "outcomes" || saved === "friction") return saved as Tab;
    } catch {}
    return "log";
  });
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem("history_friction_week");
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) return saved;
    } catch {}
    return getCurrentWeekStart();
  });
  const [frictionTypeFilter, setFrictionTypeFilter] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("history_friction_type_filter") || null;
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("history_tab", tab);
    } catch {}
  }, [tab]);

  useEffect(() => {
    try {
      sessionStorage.setItem("history_friction_week", selectedWeek);
    } catch {}
  }, [selectedWeek]);

  useEffect(() => {
    try {
      if (frictionTypeFilter) {
        sessionStorage.setItem("history_friction_type_filter", frictionTypeFilter);
      } else {
        sessionStorage.removeItem("history_friction_type_filter");
      }
    } catch {}
  }, [frictionTypeFilter]);

  const currentWeek = getCurrentWeekStart();
  const isCurrentWeek = selectedWeek === currentWeek;

  const { data: logs, isLoading: logsLoading } = useListProgressLogs(
    { limit: 60 },
    { query: { queryKey: getListProgressLogsQueryKey({ limit: 60 }) } }
  );
  const { data: weekSummary, isLoading: weekLoading } = useGetWeekSummary();
  const { data: pillarHealth, isLoading: healthLoading } = useGetPillarHealth();
  const { data: dashSummary } = useGetDashboardSummary();
  const { data: outcomes, isLoading: outcomesLoading } = useGetOutcomeMetrics({ weekOf: selectedWeek });
  const { data: friction, isLoading: frictionLoading } = useGetFrictionSignals({ weekOf: selectedWeek });

  useEffect(() => {
    if (!frictionTypeFilter || !friction) return;
    const hasType = friction.some(s => s.type === frictionTypeFilter);
    if (!hasType) {
      setFrictionTypeFilter(null);
    }
  }, [friction, frictionTypeFilter]);

  const pastWeeks = useMemo(() => getPastWeeks(12), []);
  const isWeekInDropdown = pastWeeks.includes(selectedWeek);

  const SPARKLINE_WEEK_COUNT = 6;
  const sparklineWeeks = useMemo(() => {
    const weeks: string[] = [];
    let cursor = currentWeek;
    for (let i = 0; i < SPARKLINE_WEEK_COUNT; i++) {
      weeks.unshift(cursor);
      cursor = shiftWeek(cursor, -1);
    }
    return weeks;
  }, [currentWeek]);

  const weeklyOutcomeResults = useQueries({
    queries: sparklineWeeks.map(week => ({
      ...getGetOutcomeMetricsQueryOptions({ weekOf: week }),
      enabled: tab === "outcomes",
    })),
  });

  const sparklineLoading = weeklyOutcomeResults.some(r => r.isLoading);

  const pillarSparklineData = useMemo(() => {
    const map = new Map<string, { rates: number[]; weeks: string[] }>();
    sparklineWeeks.forEach((week, i) => {
      const data = weeklyOutcomeResults[i]?.data;
      if (!data) return;
      data.pillarMetrics.forEach(pm => {
        if (!map.has(pm.pillarId)) {
          map.set(pm.pillarId, { rates: new Array(SPARKLINE_WEEK_COUNT).fill(0), weeks: sparklineWeeks });
        }
        map.get(pm.pillarId)!.rates[i] = pm.completionRate;
      });
    });
    return map;
  }, [weeklyOutcomeResults, sparklineWeeks]);

  const grouped = (logs ?? []).reduce<Record<string, typeof logs>>((acc, log) => {
    if (!log) return acc;
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date]!.push(log);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const tabs = [
    { id: "log" as Tab, icon: History, label: "Activity" },
    { id: "week" as Tab, icon: TrendingUp, label: "This week" },
    { id: "health" as Tab, icon: Activity, label: "Pillar health" },
    { id: "outcomes" as Tab, icon: BarChart2, label: "Outcomes" },
    { id: "friction" as Tab, icon: Zap, label: "Friction" },
  ];

  const portfolioBalance = pillarHealth?.portfolioBalance;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your progress over time</p>
      </motion.div>

      {/* Tab switcher */}
      <div className="grid grid-cols-5 rounded-xl bg-muted p-1 gap-0.5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-all min-w-0 overflow-hidden ${
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "log" && (
        logsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
            <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No history yet</p>
            <p className="text-xs text-muted-foreground mt-1">Complete or update tasks to see your progress here</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((date, dateIdx) => (
              <motion.section
                key={date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIdx * 0.05 }}
              >
                <h2 className="font-serif text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {formatDate(date)}
                </h2>
                <div className="rounded-2xl bg-card border border-card-border divide-y divide-border overflow-hidden">
                  {grouped[date]?.map(log => {
                    const statusInfo = log ? (statusConfig[log.status] ?? unknownStatus) : unknownStatus;
                    const StatusIcon = statusInfo.icon;
                    return log ? (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-3">
                        <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusInfo.className}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-foreground truncate ${log.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {log.taskTitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <CategoryBadge category={log.category} />
                          <span className={`text-xs font-medium ${statusInfo.className}`}>{statusInfo.label}</span>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </motion.section>
            ))}
          </div>
        )
      )}

      {tab === "week" && (
        weekLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : weekSummary ? (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Done", count: weekSummary.doneCount, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                { label: "Pushed", count: weekSummary.pushedCount, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
                { label: "Passed", count: weekSummary.passedCount, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-900/20" },
                { label: "Blocked", count: weekSummary.blockedCount, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className={`rounded-2xl p-4 ${bg}`}>
                  <p className={`text-2xl font-serif font-medium ${color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Completion rate */}
            <div className="rounded-2xl bg-card border border-card-border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Completion rate</p>
                <p className="font-serif text-lg font-medium text-primary">
                  {Math.round(weekSummary.completionRate * 100)}%
                </p>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${weekSummary.completionRate * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{weekSummary.totalTasks} tasks total this week</p>
            </div>

            {/* Pillar activity with tasks */}
            {weekSummary.pillarActivity && weekSummary.pillarActivity.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">By pillar</p>
                {weekSummary.pillarActivity.map(pa => (
                  <div key={pa.pillarId} className="rounded-2xl bg-card border border-card-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-primary/70" />
                        <span className="text-sm font-medium text-foreground">{pa.pillarName}</span>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{pa.taskCount} task{pa.taskCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {pa.tasks.map(task => {
                        const statusInfo = statusConfig[task.status] ?? unknownStatus;
                        const StatusIcon = statusInfo.icon;
                        return (
                          <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                            <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusInfo.className}`} />
                            <span className={`text-sm flex-1 min-w-0 truncate ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground/80"}`}>
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <CategoryBadge category={task.category} />
                              <span className={`text-xs font-medium ${statusInfo.className}`}>{statusInfo.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {weekSummary.totalTasks === 0 && (
              <div className="text-center py-10 rounded-2xl bg-card border border-dashed border-border">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No tasks this week yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add tasks on the Today page to start tracking</p>
              </div>
            )}

            {/* Weekly reflection fields */}
            {dashSummary?.weeklyPlan && (dashSummary.weeklyPlan.whatToDeprioritize || dashSummary.weeklyPlan.nextWeekFocus) && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Reflection</p>
                {dashSummary.weeklyPlan.whatToDeprioritize && (
                  <div className="rounded-2xl bg-card border border-card-border p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ArrowDown className="h-3.5 w-3.5 text-amber-500" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What to deprioritize</p>
                    </div>
                    <p className="text-sm text-foreground/80">{dashSummary.weeklyPlan.whatToDeprioritize}</p>
                  </div>
                )}
                {dashSummary.weeklyPlan.nextWeekFocus && (
                  <div className="rounded-2xl bg-card border border-card-border p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Target className="h-3.5 w-3.5 text-primary/70" />
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next week's focus</p>
                    </div>
                    <p className="text-sm text-foreground/80">{dashSummary.weeklyPlan.nextWeekFocus}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null
      )}

      {tab === "health" && (
        healthLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : !pillarHealth || (pillarHealth.pillars ?? []).length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No pillar data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add pillars in Projects to see their health here</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">Pillar momentum this week</p>
            {(pillarHealth.pillars ?? []).map((entry, i) => {
              const healthStatus: "green" | "amber" | "red" =
                entry.warning ? "red"
                : entry.nudge || (entry.tasksPushedOrPassedThisWeek > entry.tasksDoneThisWeek && entry.tasksDoneThisWeek === 0) ? "amber"
                : "green";

              const healthDot: Record<"green" | "amber" | "red", string> = {
                green: "bg-emerald-500",
                amber: "bg-amber-400",
                red: "bg-rose-500",
              };
              const healthLabel: Record<"green" | "amber" | "red", string> = {
                green: "Healthy",
                amber: "Attention",
                red: "Concern",
              };

              return (
              <motion.div
                key={entry.pillarId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl bg-card border border-card-border p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${healthDot[healthStatus]}`} title={healthLabel[healthStatus]} />
                      <span className="font-serif font-medium text-foreground">{entry.pillarName}</span>
                      {entry.portfolioStatus && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${portfolioStatusColors[entry.portfolioStatus] ?? "text-muted-foreground bg-muted/50"}`}>
                          {entry.portfolioStatus}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${healthStatus === "green" ? "text-emerald-600 dark:text-emerald-400" : healthStatus === "amber" ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {healthLabel[healthStatus]}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-serif font-medium text-emerald-600 dark:text-emerald-400">{entry.tasksDoneThisWeek}</p>
                    <p className="text-xs text-muted-foreground">done</p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {entry.tasksPushedOrPassedThisWeek > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {entry.tasksPushedOrPassedThisWeek} pushed/passed
                    </span>
                  )}
                  {entry.daysSinceLastMovement !== null && entry.daysSinceLastMovement !== undefined && (
                    <span>
                      Last move: {entry.daysSinceLastMovement === 0 ? "today" : `${entry.daysSinceLastMovement}d ago`}
                    </span>
                  )}
                </div>

                {/* Nudge */}
                {entry.nudge && (
                  <div className="flex items-start gap-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 px-3 py-2">
                    <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-sky-700 dark:text-sky-400">{entry.nudge}</p>
                  </div>
                )}

                {/* Warning for Warm/Parked over-absorption */}
                {entry.warning && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">{entry.warning}</p>
                  </div>
                )}
              </motion.div>
              );
            })}
          </div>
        )
      )}

      {tab === "outcomes" && (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="flex items-center gap-2 rounded-2xl bg-card border border-card-border px-3 py-3">
            <button
              type="button"
              onClick={() => setSelectedWeek(w => shiftWeek(w, -1))}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <select
                value={isWeekInDropdown ? selectedWeek : ""}
                onChange={e => { if (e.target.value) setSelectedWeek(e.target.value); }}
                className="w-full bg-transparent text-sm font-medium text-foreground text-center appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-lg py-1 px-2 hover:bg-muted transition-colors"
                aria-label="Select week"
              >
                {!isWeekInDropdown && (
                  <option value="">{formatWeekRange(selectedWeek)}</option>
                )}
                {pastWeeks.map((week, i) => (
                  <option key={week} value={week}>
                    {i === 0 ? `This week (${formatWeekRange(week)})` : formatWeekRange(week)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWeek(w => shiftWeek(w, 1))}
              disabled={isCurrentWeek}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {outcomesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : !outcomes ? null : (
          <div className="space-y-4">
            {/* Milestone stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-card border border-card-border p-4">
                <p className="text-2xl font-serif font-medium text-emerald-600 dark:text-emerald-400">
                  {outcomes.milestonesCompletedThisWeek}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Milestones done this week</p>
              </div>
              <div className="rounded-2xl bg-card border border-card-border p-4">
                <p className="text-2xl font-serif font-medium text-primary">
                  {outcomes.milestonesCompletedThisMonth}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Milestones done this month</p>
              </div>
              {outcomes.averageActiveMilestoneDays != null && (
                <div className="rounded-2xl bg-card border border-card-border p-4 col-span-2">
                  <p className="text-2xl font-serif font-medium text-foreground">
                    {Math.round(outcomes.averageActiveMilestoneDays)}
                    <span className="text-base font-sans font-normal text-muted-foreground ml-1">days avg</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Average time active milestones stay open</p>
                </div>
              )}
            </div>

            {/* Pillar completion rates */}
            {outcomes.pillarMetrics.length > 0 && (
              <CollapsibleSection
                title="Completion by pillar"
                summary={
                  <p className="text-sm text-foreground/80">
                    {outcomes.pillarMetrics.length} pillar{outcomes.pillarMetrics.length !== 1 ? "s" : ""} tracked —
                    avg {Math.round(outcomes.pillarMetrics.reduce((s, p) => s + p.completionRate, 0) / outcomes.pillarMetrics.length * 100)}% completion
                  </p>
                }
              >
                {outcomes.pillarMetrics.map(pm => {
                  const passedCount = pm.passedCount ?? 0;
                  const otherCount = Math.max(0, pm.totalCount - pm.doneCount - pm.blockedCount - passedCount);
                  const hasActivity = pm.totalCount > 0;
                  const sparklineEntry = pillarSparklineData.get(pm.pillarId);
                  return (
                    <div key={pm.pillarId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate min-w-0">{pm.pillarName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {pm.doneCount}/{pm.totalCount} done
                            {pm.blockedCount > 0 && ` · ${pm.blockedCount} blocked`}
                          </span>
                          {sparklineLoading ? (
                            <Skeleton className="h-7 w-16 rounded" />
                          ) : sparklineEntry ? (
                            <>
                              <PillarTrendIndicator rates={sparklineEntry.rates} />
                              <PillarSparkline
                                rates={sparklineEntry.rates}
                                weeks={sparklineEntry.weeks}
                                selectedWeek={selectedWeek}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                      {hasActivity ? (
                        <ProportionBar
                          segments={[
                            { label: "Done", value: pm.doneCount, color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-400" },
                            { label: "Blocked", value: pm.blockedCount, color: "bg-rose-400", textColor: "text-rose-600 dark:text-rose-400" },
                            { label: "Passed", value: passedCount, color: "bg-sky-400", textColor: "text-sky-600 dark:text-sky-400" },
                            ...(otherCount > 0 ? [{ label: "Other", value: otherCount, color: "bg-muted-foreground/30", textColor: "text-muted-foreground" }] : []),
                          ].filter(s => s.value > 0)}
                        />
                      ) : (
                        <div className="h-2 rounded-full bg-muted" />
                      )}
                      {!hasActivity && (
                        <p className="text-xs text-muted-foreground italic">No tasks this week</p>
                      )}
                    </div>
                  );
                })}
              </CollapsibleSection>
            )}

            {/* P1 vs Warm/Parked effort ratio */}
            <CollapsibleSection
              title="P1 vs Warm/Parked effort"
              summary={
                outcomes.p1VsWarmParkedRatio != null ? (
                  <div className="space-y-2">
                    <ProportionBar
                      segments={[
                        { label: "P1 done", value: outcomes.p1CompletedThisWeek, color: "bg-rose-400", textColor: "text-rose-600 dark:text-rose-400" },
                        { label: "Warm/Parked done", value: outcomes.warmParkedCompletedThisWeek, color: "bg-amber-300", textColor: "text-amber-600 dark:text-amber-400" },
                      ]}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ratio: {outcomes.p1VsWarmParkedRatio.toFixed(1)}:1 (P1 vs Warm/Parked)
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not enough data — complete tasks from P1 and Warm/Parked pillars to see the ratio.</p>
                )
              }
            >
              <div className="space-y-1.5 text-xs text-foreground/80">
                <p><span className="font-medium text-rose-600 dark:text-rose-400">{outcomes.p1CompletedThisWeek}</span> tasks done from P1 pillars this week</p>
                <p><span className="font-medium text-amber-600 dark:text-amber-400">{outcomes.warmParkedCompletedThisWeek}</span> tasks done from Warm or Parked pillars this week</p>
                <p className="text-muted-foreground pt-1">A ratio above 2:1 means P1 work is getting proportional focus.</p>
              </div>
            </CollapsibleSection>

            {/* Portfolio balance */}
            {portfolioBalance && (
              <CollapsibleSection
                title="Portfolio balance"
                summary={
                  <ProportionBar
                    segments={[
                      {
                        label: "Active",
                        value: portfolioBalance.activeShare,
                        color: "bg-emerald-500",
                        textColor: "text-emerald-700 dark:text-emerald-400",
                      },
                      {
                        label: "Warm",
                        value: portfolioBalance.warmShare,
                        color: "bg-amber-400",
                        textColor: "text-amber-700 dark:text-amber-400",
                        warning: portfolioBalance.warmShare > 30,
                      },
                      {
                        label: "Parked",
                        value: portfolioBalance.parkedShare,
                        color: "bg-slate-300 dark:bg-slate-600",
                        textColor: "text-muted-foreground",
                        warning: portfolioBalance.parkedShare > 30,
                      },
                    ]}
                  />
                }
              >
                <p className="text-xs text-muted-foreground">
                  Portfolio balance measures what share of completed tasks came from each status tier this week.
                  A healthy portfolio has most effort going into Active pillars.
                </p>
                {(portfolioBalance.warmShare > 30 || portfolioBalance.parkedShare > 30) && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Consider whether the effort going into Warm or Parked pillars is intentional — it may be pulling focus from your top priorities.
                    </p>
                  </div>
                )}
                {(() => {
                  const overPillars = (pillarHealth?.pillars ?? []).filter(p => (p.portfolioSharePercent ?? 0) > 30);
                  if (overPillars.length === 0) return null;
                  return (
                    <div className="space-y-1.5 mt-1">
                      <p className="text-xs font-medium text-muted-foreground">Individual pillars over 30%:</p>
                      {overPillars.map(p => (
                        <div key={p.pillarId} className="flex items-center justify-between text-xs">
                          <span className="text-foreground/80 truncate max-w-[65%]">{p.pillarName}</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
                            {p.portfolioSharePercent}% of done work
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CollapsibleSection>
            )}
          </div>
        )}
        </div>
      )}

      {tab === "friction" && (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="flex items-center gap-2 rounded-2xl bg-card border border-card-border px-3 py-3">
            <button
              type="button"
              onClick={() => setSelectedWeek(w => shiftWeek(w, -1))}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <select
                value={isWeekInDropdown ? selectedWeek : ""}
                onChange={e => { if (e.target.value) setSelectedWeek(e.target.value); }}
                className="w-full bg-transparent text-sm font-medium text-foreground text-center appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-lg py-1 px-2 hover:bg-muted transition-colors"
                aria-label="Select week"
              >
                {!isWeekInDropdown && (
                  <option value="">{formatWeekRange(selectedWeek)}</option>
                )}
                {pastWeeks.map((week, i) => (
                  <option key={week} value={week}>
                    {i === 0 ? `This week (${formatWeekRange(week)})` : formatWeekRange(week)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setSelectedWeek(w => shiftWeek(w, 1))}
              disabled={isCurrentWeek}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground px-1 -mt-1">
            The selected week shifts the month and 14-day windows used by some signals. Repeated pass and repeated block always look at all-time history.
          </p>

          {frictionLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : !friction || friction.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
            <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground mt-1">No friction patterns detected — things look healthy</p>
          </div>
        ) : (() => {
            const typeCounts = friction.reduce<Record<string, number>>((acc, s) => {
              acc[s.type] = (acc[s.type] ?? 0) + 1;
              return acc;
            }, {});
            const uniqueTypes = Object.keys(typeCounts);
            const effectiveFilter = frictionTypeFilter && typeCounts[frictionTypeFilter]
              ? frictionTypeFilter
              : null;
            const displayed = effectiveFilter ? friction.filter(s => s.type === effectiveFilter) : friction;
            return (
          <div className="space-y-3">
            {uniqueTypes.length >= 2 && (
              <div className="flex flex-wrap gap-2">
                {uniqueTypes.map(type => {
                  const cfg = frictionTypeConfig[type] ?? { icon: AlertCircle, label: type, iconClass: "text-muted-foreground" };
                  const IconComp = cfg.icon;
                  const active = effectiveFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFrictionTypeFilter(active ? null : type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-foreground border-card-border hover:bg-muted"
                      }`}
                    >
                      <IconComp className={`h-3 w-3 ${active ? "" : cfg.iconClass}`} />
                      {cfg.label}
                      <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        active ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                      }`}>
                        {typeCounts[type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <>
              <p className="text-xs text-muted-foreground px-1">{displayed.length} pattern{displayed.length !== 1 ? "s" : ""} worth a look</p>
              {displayed.map((signal, i) => {
              const config = frictionTypeConfig[signal.type] ?? { icon: AlertCircle, label: signal.type, iconClass: "text-muted-foreground" };
              const IconComponent = config.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-card border border-card-border p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-4 w-4 flex-shrink-0 ${config.iconClass}`} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{config.label}</span>
                    {signal.pillarName && (
                      <span className="ml-auto text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full truncate max-w-[40%]">
                        {signal.pillarName}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 leading-none">Window: {config.timeWindow}</p>
                  {(signal.taskTitle || signal.milestoneTitle) && (
                    <p className="text-sm font-medium text-foreground">
                      {signal.taskTitle ?? signal.milestoneTitle}
                    </p>
                  )}
                  <p className="text-xs text-foreground/70 leading-relaxed">{signal.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {signal.lastSeenDate
                      ? `Last seen: ${formatShortDate(signal.lastSeenDate)}`
                      : "Last seen: never"}
                  </p>
                </motion.div>
              );
            })}
            </>
          </div>
        );
        })()}
        </div>
      )}
    </div>
  );
}
