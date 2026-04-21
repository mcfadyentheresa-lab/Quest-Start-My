import { useEffect } from "react";
import { motion } from "framer-motion";
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
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Save } from "lucide-react";
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

export default function TodayPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useListDailyPlans(
    { date: today },
    { query: { queryKey: getListDailyPlansQueryKey({ date: today }) } }
  );

  const createPlan = useCreateDailyPlan();
  const updatePlan = useUpdateDailyPlan();

  const existingPlan = plans?.[0];
  const isSaving = createPlan.isPending || updatePlan.isPending;

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

      {isLoading ? (
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
    </div>
  );
}
