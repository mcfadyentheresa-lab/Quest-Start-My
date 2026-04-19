import { motion } from "framer-motion";
import { useListProgressLogs, getListProgressLogsQueryKey } from "@workspace/api-client-react";
import { CategoryBadge } from "@/components/category-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, SkipForward, Pause, AlertCircle, History } from "lucide-react";

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
};

export default function HistoryPage() {
  const { data: logs, isLoading } = useListProgressLogs(
    { limit: 60 },
    { query: { queryKey: getListProgressLogsQueryKey({ limit: 60 }) } }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const grouped = (logs ?? []).reduce<Record<string, typeof logs>>((acc, log) => {
    if (!log) return acc;
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date]!.push(log);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your task log over time</p>
      </motion.div>

      {sortedDates.length === 0 ? (
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
                {grouped[date]?.map((log, i) => {
                  const statusInfo = log ? (statusConfig[log.status] ?? statusConfig.done) : statusConfig.done;
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
      )}
    </div>
  );
}
