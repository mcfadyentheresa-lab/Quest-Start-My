import { motion } from "framer-motion";
import { Check, RotateCcw, Plus, MoreHorizontal, Timer, AlertTriangle } from "lucide-react";
import type { BriefingResponse, BriefingItem } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/priority-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

type BriefingCardProps = {
  briefing: BriefingResponse;
  isReshuffling: boolean;
  isApproving: boolean;
  onApprove: () => void;
  onReshuffle: () => void;
  onAddOwn: () => void;
  onStartFocus: (item: BriefingItem) => void;
  onMarkDone: (item: BriefingItem) => void;
  onPushTask: (item: BriefingItem) => void;
  onMarkBlocked: (item: BriefingItem) => void;
};

export function BriefingCard({
  briefing,
  isReshuffling,
  isApproving,
  onApprove,
  onReshuffle,
  onAddOwn,
  onStartFocus,
  onMarkDone,
  onPushTask,
  onMarkBlocked,
}: BriefingCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl bg-card border border-card-border p-7 shadow-sm"
      data-testid="briefing-card"
    >
      {briefing.context && (
        <p className="text-sm text-foreground/70 leading-relaxed mb-5">
          {briefing.context}
        </p>
      )}

      {briefing.briefing.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No open tasks today. Add one below or plan the week.
        </div>
      ) : (
        <ol className="space-y-5">
          {briefing.briefing.map((item, idx) => (
            <BriefingRow
              key={`${item.taskId ?? "new"}-${idx}`}
              item={item}
              index={idx + 1}
              onStartFocus={() => onStartFocus(item)}
              onMarkDone={() => onMarkDone(item)}
              onPush={() => onPushTask(item)}
              onBlocked={() => onMarkBlocked(item)}
            />
          ))}
        </ol>
      )}

      <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={onApprove}
          disabled={isApproving || briefing.approved}
          data-testid="briefing-approve"
        >
          <Check className="h-3.5 w-3.5" />
          {briefing.approved ? "Plan locked in" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5"
          onClick={onReshuffle}
          disabled={isReshuffling}
          data-testid="briefing-reshuffle"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isReshuffling ? "animate-spin" : ""}`} />
          Reshuffle
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5"
          onClick={onAddOwn}
          data-testid="briefing-add-own"
        >
          <Plus className="h-3.5 w-3.5" />
          Add my own
        </Button>
      </div>
    </motion.section>
  );
}

function BriefingRow({
  item,
  index,
  onStartFocus,
  onMarkDone,
  onPush,
  onBlocked,
}: {
  item: BriefingItem;
  index: number;
  onStartFocus: () => void;
  onMarkDone: () => void;
  onPush: () => void;
  onBlocked: () => void;
}) {
  return (
    <li className="flex gap-4" data-testid={`briefing-item-${index}`}>
      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
        {index}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="font-serif text-lg font-medium text-foreground leading-snug">
            {item.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <PillarPill name={item.pillarName} color={item.pillarColor} />
            <PriorityBadge priority={item.priority} />
          </div>
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {item.reasoning}
        </p>
        {item.suggestedNextStep && !item.taskId && (
          <p className="text-xs text-primary/80 italic">
            Suggested next step: {item.suggestedNextStep}
          </p>
        )}
        {item.blockedBy && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 dark:text-rose-300">{item.blockedBy}</p>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={onStartFocus}
            data-testid={`briefing-start-${index}`}
          >
            <Timer className="h-3.5 w-3.5" />
            Start focus block · {item.estimatedMinutes}m
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl px-2"
                aria-label={`More actions for ${item.title}`}
                data-testid={`briefing-more-${index}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMarkDone}>Mark done</DropdownMenuItem>
              <DropdownMenuItem onClick={onPush}>Push to tomorrow</DropdownMenuItem>
              <DropdownMenuItem onClick={onBlocked}>Mark blocked</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function PillarPill({ name, color }: { name: string; color: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground/80">
      {color && (
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
    </span>
  );
}

export function BriefingCardSkeleton() {
  return (
    <div
      className="rounded-3xl bg-card border border-card-border p-7 space-y-5"
      data-testid="briefing-skeleton"
    >
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-40 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BriefingCardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-7 text-center"
      data-testid="briefing-error"
    >
      <p className="font-serif text-base text-foreground mb-1">
        Couldn't reach your assistant.
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Showing a basic plan based on your active areas.
      </p>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
