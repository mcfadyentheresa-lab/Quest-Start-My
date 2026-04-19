import { useState } from "react";
import { motion } from "framer-motion";
import {
  useListProgressLogs,
  getListProgressLogsQueryKey,
  useGetWeekSummary,
  useGetPillarHealth,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import { CategoryBadge } from "@/components/category-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, SkipForward, Pause, AlertCircle, History, TrendingUp, Layers, Clock,
  Activity, AlertTriangle, Info, ArrowDown, Target,
} from "lucide-react";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
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

type Tab = "log" | "week" | "health";

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("log");

  const { data: logs, isLoading: logsLoading } = useListProgressLogs(
    { limit: 60 },
    { query: { queryKey: getListProgressLogsQueryKey({ limit: 60 }) } }
  );
  const { data: weekSummary, isLoading: weekLoading } = useGetWeekSummary();
  const { data: pillarHealth, isLoading: healthLoading } = useGetPillarHealth();
  const { data: dashSummary } = useGetDashboardSummary();

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
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your progress over time</p>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(" ")[0]}</span>
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
        ) : !pillarHealth || pillarHealth.length === 0 ? (
          <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No pillar data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add pillars in Projects to see their health here</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground px-1">Pillar momentum this week</p>
            {pillarHealth.map((entry, i) => {
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
    </div>
  );
}
