import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDailyPlans,
  useCreateDailyPlan,
  useUpdateDailyPlan,
  getListDailyPlansQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DataLoadError } from "@/components/data-load-error";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Save, ChevronDown, ChevronUp, History } from "lucide-react";
import { useForm } from "react-hook-form";

interface DailyPlanFormData {
  priority1: string;
  priority2: string;
  priority3: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function TodayPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: todayPlans, isLoading, isError, refetch } = useListDailyPlans(
    { date: today },
    { query: { queryKey: getListDailyPlansQueryKey({ date: today }) } }
  );

  const { data: allPlans, isLoading: isHistoryLoading } = useListDailyPlans(
    {},
    { query: { queryKey: getListDailyPlansQueryKey(), enabled: historyOpen } }
  );

  const createPlan = useCreateDailyPlan();
  const updatePlan = useUpdateDailyPlan();

  const existingPlan = todayPlans?.[0];
  const isSaving = createPlan.isPending || updatePlan.isPending;

  const pastPlans = (allPlans ?? []).filter((p) => p.date !== today);

  const { register, handleSubmit, reset } = useForm<DailyPlanFormData>({
    defaultValues: { priority1: "", priority2: "", priority3: "" },
  });

  useEffect(() => {
    if (existingPlan) {
      const [p1 = "", p2 = "", p3 = ""] = existingPlan.priorities;
      reset({ priority1: p1, priority2: p2, priority3: p3 });
    }
  }, [existingPlan, reset]);

  const onSubmit = async (data: DailyPlanFormData) => {
    const priorities = [data.priority1, data.priority2, data.priority3].filter(Boolean);

    try {
      if (existingPlan) {
        await updatePlan.mutateAsync({ id: existingPlan.id, data: { priorities } });
      } else {
        await createPlan.mutateAsync({ data: { date: today, priorities } });
      }
      await queryClient.invalidateQueries({ queryKey: getListDailyPlansQueryKey({ date: today }) });
      toast({ title: "Plan saved", description: "Your daily priorities are set." });
    } catch {
      toast({ title: "Could not save", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl font-medium text-foreground">Daily plan</h1>
        </div>
        <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
      </motion.div>

      {isError ? (
        <DataLoadError
          title="Couldn't load today's plan"
          message="We can't reach your data right now. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >
          <div className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top 3 priorities for today</p>
            {(["priority1", "priority2", "priority3"] as const).map((field, i) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`today-${field}`} className="text-xs text-muted-foreground">Priority {i + 1}</Label>
                <Input
                  id={`today-${field}`}
                  {...register(field)}
                  placeholder={
                    i === 0
                      ? "Your most important thing today"
                      : i === 1
                      ? "Second priority for today"
                      : "Third priority for today"
                  }
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full rounded-xl gap-2" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : existingPlan ? "Update plan" : "Save plan"}
          </Button>
        </motion.form>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl bg-card border border-card-border px-5 py-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Past plans</span>
          </div>
          {historyOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {historyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2">
                {isHistoryLoading ? (
                  <div className="space-y-2 px-1">
                    <Skeleton className="h-20 w-full rounded-xl" />
                    <Skeleton className="h-20 w-full rounded-xl" />
                  </div>
                ) : pastPlans.length === 0 ? (
                  <div className="rounded-xl border border-card-border bg-card px-5 py-6 text-center">
                    <p className="text-sm text-muted-foreground">No past plans yet. Start planning daily to build your history.</p>
                  </div>
                ) : (
                  pastPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-card-border bg-card px-5 py-4 space-y-2"
                    >
                      <p className="text-xs font-semibold text-muted-foreground">{formatDateShort(plan.date)}</p>
                      <ol className="space-y-1">
                        {plan.priorities.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                              {i + 1}
                            </span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
