import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import type { RecapResponse } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type EveningRecapCardProps = {
  recap: RecapResponse;
  isRegenerating: boolean;
  onRegenerate: () => void;
  onPlanTomorrow: () => void;
  onSaveReflection: (text: string) => void;
};

export function EveningRecapCard({
  recap,
  isRegenerating,
  onRegenerate,
  onPlanTomorrow,
  onSaveReflection,
}: EveningRecapCardProps) {
  const [reflection, setReflection] = useState(recap.reflection ?? "");
  const lastSavedRef = useRef(recap.reflection ?? "");

  // If the recap is regenerated upstream, sync local state.
  useEffect(() => {
    setReflection(recap.reflection ?? "");
    lastSavedRef.current = recap.reflection ?? "";
  }, [recap.date, recap.reflection]);

  const handleBlur = () => {
    const next = reflection.trim();
    if (next === (lastSavedRef.current ?? "").trim()) return;
    lastSavedRef.current = next;
    onSaveReflection(next);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl bg-card border border-card-border p-7 shadow-sm"
      data-testid="evening-recap-card"
    >
      <p className="text-sm text-foreground/70 leading-relaxed mb-5">
        {recap.areaBreakdown}
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <RecapList
          label="Closed today"
          accent="text-emerald-700 dark:text-emerald-400"
          icon={<Check className="h-3.5 w-3.5" />}
          items={recap.closedToday}
          emptyText="Nothing closed today."
          testid="recap-closed"
        />
        <RecapList
          label="Rolled to tomorrow"
          accent="text-foreground/80"
          icon={<ArrowRight className="h-3.5 w-3.5" />}
          items={recap.rolledToTomorrow}
          emptyText="Nothing rolling — tomorrow's clean."
          testid="recap-rolled"
        />
      </div>

      <div className="mt-6 pt-5 border-t border-border">
        <label
          htmlFor="recap-reflection"
          className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2"
        >
          {recap.reflectionPrompt}
        </label>
        <input
          id="recap-reflection"
          type="text"
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onBlur={handleBlur}
          placeholder="One line is enough."
          maxLength={500}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          data-testid="recap-reflection-input"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={onPlanTomorrow}
          data-testid="recap-plan-tomorrow"
        >
          Plan tomorrow
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5"
          onClick={onRegenerate}
          disabled={isRegenerating}
          data-testid="recap-regenerate"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>
    </motion.section>
  );
}

function RecapList({
  label,
  accent,
  icon,
  items,
  emptyText,
  testid,
}: {
  label: string;
  accent: string;
  icon: React.ReactNode;
  items: { taskId: number | null; title: string; pillarName: string; pillarColor: string | null }[];
  emptyText: string;
  testid: string;
}) {
  return (
    <div data-testid={testid}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${accent}`}>
        {icon}
        {label}
        <span className="text-muted-foreground font-normal">· {items.length}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li
              key={`${item.taskId ?? "x"}-${idx}`}
              className="flex items-start gap-2 text-sm text-foreground/80"
            >
              {item.pillarColor && (
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.pillarColor }}
                />
              )}
              <span className="leading-snug">
                {item.title}
                <span className="text-muted-foreground text-xs ml-2">
                  {item.pillarName}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EveningRecapCardSkeleton() {
  return (
    <div
      className="rounded-3xl bg-card border border-card-border p-7 space-y-5"
      data-testid="recap-skeleton"
    >
      <Skeleton className="h-4 w-3/4" />
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-9 w-full rounded-xl" />
    </div>
  );
}

export function EveningRecapCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-7 text-center"
      data-testid="recap-error"
    >
      <p className="font-serif text-base text-foreground mb-1">
        Couldn't reach your assistant.
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Showing a basic recap based on today's closed work.
      </p>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
