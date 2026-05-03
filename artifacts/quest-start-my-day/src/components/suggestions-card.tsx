import { useState } from "react";
import {
  useGetTaskSuggestions,
  useCreateTask,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetTaskSuggestionsQueryKey,
} from "@workspace/api-client-react";
import type { TaskSuggestion } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  date: string;
};

/**
 * Empty-state card that proposes up to 3 next-action tasks pulled from the
 * user's active areas + planned milestones. Lets the user accept all at once
 * or pick them one at a time.
 */
export function SuggestionsCard({ date }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: suggestions, isLoading } = useGetTaskSuggestions({ date });
  const createTask = useCreateTask();
  const [acceptingIds, setAcceptingIds] = useState<Set<number>>(new Set());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskSuggestionsQueryKey({ date }) });
  };

  const acceptOne = (s: TaskSuggestion) => {
    setAcceptingIds((prev) => new Set(prev).add(s.milestoneId));
    createTask.mutate(
      {
        data: {
          title: s.title,
          category: s.areaCategory ?? "business",
          areaId: s.areaId,
          milestoneId: s.milestoneId,
          date,
        },
      },
      {
        onSuccess: () => {
          invalidate();
        },
        onError: () => {
          toast({ title: "Couldn't add task", variant: "destructive" });
          setAcceptingIds((prev) => {
            const next = new Set(prev);
            next.delete(s.milestoneId);
            return next;
          });
        },
      },
    );
  };

  const acceptAll = () => {
    if (!suggestions) return;
    for (const s of suggestions) acceptOne(s);
    toast({ title: `Added ${suggestions.length} task${suggestions.length === 1 ? "" : "s"}` });
  };

  if (isLoading) return null;
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Today's plan, drafted for you</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Pulled from your active areas and goals. Add the ones that fit today.
      </p>
      <ul className="space-y-2 mb-3">
        {suggestions.map((s) => {
          const isAdding = acceptingIds.has(s.milestoneId);
          return (
            <li
              key={s.milestoneId}
              className="flex items-start justify-between gap-3 rounded-xl bg-background/60 p-3 border border-border/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {s.areaColor && (
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: s.areaColor }}
                    />
                  )}
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
                    {s.areaName} · {s.milestoneTitle}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-snug">{s.title}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl flex-shrink-0"
                onClick={() => acceptOne(s)}
                disabled={isAdding}
                aria-label={`Add task: ${s.title}`}
              >
                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        className="rounded-xl w-full"
        onClick={acceptAll}
        disabled={createTask.isPending || acceptingIds.size > 0}
      >
        Add all {suggestions.length} to today
      </Button>
    </div>
  );
}
