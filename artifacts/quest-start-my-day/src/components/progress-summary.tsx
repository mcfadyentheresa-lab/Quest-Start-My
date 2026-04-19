interface ProgressSummaryProps {
  doneCount: number;
  pushedCount: number;
  passedCount: number;
  blockedCount: number;
  totalCount: number;
}

export function ProgressSummary({ doneCount, pushedCount, passedCount, blockedCount, totalCount }: ProgressSummaryProps) {
  const items = [
    { label: "Done", count: doneCount, className: "text-emerald-700 dark:text-emerald-400", bgClassName: "bg-emerald-100 dark:bg-emerald-900/20" },
    { label: "Pushed", count: pushedCount, className: "text-amber-700 dark:text-amber-400", bgClassName: "bg-amber-100 dark:bg-amber-900/20" },
    { label: "Passed", count: passedCount, className: "text-sky-700 dark:text-sky-400", bgClassName: "bg-sky-100 dark:bg-sky-900/20" },
    { label: "Blocked", count: blockedCount, className: "text-rose-700 dark:text-rose-400", bgClassName: "bg-rose-100 dark:bg-rose-900/20" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(({ label, count, className, bgClassName }) => (
        <div key={label} className={`rounded-xl p-3 text-center ${bgClassName}`}>
          <div className={`text-2xl font-serif font-medium ${className}`}>{count}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
        </div>
      ))}
    </div>
  );
}
