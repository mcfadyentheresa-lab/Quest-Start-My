const categoryConfig: Record<string, { label: string; className: string }> = {
  business: {
    label: "Business",
    className: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
  },
  creative: {
    label: "Creative",
    className: "bg-violet-50 text-violet-800 border border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800",
  },
  wellness: {
    label: "Wellness",
    className: "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800",
  },
};

export function CategoryBadge({ category }: { category: string }) {
  const config = categoryConfig[category] ?? { label: category, className: "bg-muted text-muted-foreground border border-border" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
