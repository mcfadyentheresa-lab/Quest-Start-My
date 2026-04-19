interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  P1: { label: "P1", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800" },
  P2: { label: "P2", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  P3: { label: "P3", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800" },
  P4: { label: "P4", className: "bg-muted text-muted-foreground border border-border" },
};

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? priorityConfig.P4;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}

export function PriorityLegend() {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {Object.entries(priorityConfig).map(([key, { label, className }]) => (
        <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide ${className}`}>
          {label}
        </span>
      ))}
      <span className="text-xs text-muted-foreground ml-1">P1 = highest priority</span>
    </div>
  );
}
