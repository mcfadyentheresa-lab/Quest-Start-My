import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMonthlyReviews,
  useCreateMonthlyReview,
  useUpdateMonthlyReview,
  getListMonthlyReviewsQueryKey,
  type MonthlyReview,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, Save } from "lucide-react";
import { useForm } from "react-hook-form";

interface ReviewFormData {
  whatMoved: string;
  pillarsAdvanced: string;
  milestonesCompleted: string;
  whatDelayed: string;
  whatToPause: string;
  priority1: string;
  priority2: string;
  priority3: string;
}

function getRecentMonths(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return months;
}

function formatMonth(monthOf: string): string {
  const [y, m] = monthOf.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function reviewToFormValues(review: MonthlyReview): ReviewFormData {
  const [p1 = "", p2 = "", p3 = ""] = review.topPrioritiesNextMonth ?? [];
  return {
    whatMoved: review.whatMoved ?? "",
    pillarsAdvanced: review.pillarsAdvanced ?? "",
    milestonesCompleted: review.milestonesCompleted ?? "",
    whatDelayed: review.whatDelayed ?? "",
    whatToPause: review.whatToPause ?? "",
    priority1: p1,
    priority2: p2,
    priority3: p3,
  };
}

export default function ReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const months = getRecentMonths();
  const currentMonth = months[0]!;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const { data: reviews, isLoading } = useListMonthlyReviews();
  const createReview = useCreateMonthlyReview();
  const updateReview = useUpdateMonthlyReview();

  const { register, handleSubmit, reset } = useForm<ReviewFormData>({
    defaultValues: {
      whatMoved: "",
      pillarsAdvanced: "",
      milestonesCompleted: "",
      whatDelayed: "",
      whatToPause: "",
      priority1: "",
      priority2: "",
      priority3: "",
    },
  });

  const existingReview = reviews?.find(r => r.monthOf === selectedMonth) ?? null;

  useEffect(() => {
    if (existingReview) {
      reset(reviewToFormValues(existingReview));
    } else {
      reset({
        whatMoved: "",
        pillarsAdvanced: "",
        milestonesCompleted: "",
        whatDelayed: "",
        whatToPause: "",
        priority1: "",
        priority2: "",
        priority3: "",
      });
    }
  }, [existingReview?.id, selectedMonth]);

  const onSubmit = (data: ReviewFormData) => {
    const priorities = [data.priority1, data.priority2, data.priority3].filter(Boolean);
    const payload = {
      whatMoved: data.whatMoved || null,
      pillarsAdvanced: data.pillarsAdvanced || null,
      milestonesCompleted: data.milestonesCompleted || null,
      whatDelayed: data.whatDelayed || null,
      whatToPause: data.whatToPause || null,
      topPrioritiesNextMonth: priorities.length > 0 ? priorities : null,
    };

    if (existingReview) {
      updateReview.mutate(
        { id: existingReview.id, data: payload },
        {
          onSuccess: (saved) => {
            queryClient.invalidateQueries({ queryKey: getListMonthlyReviewsQueryKey() });
            reset(reviewToFormValues(saved));
            toast({ title: "Review updated" });
          },
          onError: () => toast({ title: "Failed to save", variant: "destructive" }),
        }
      );
    } else {
      createReview.mutate(
        { data: { monthOf: selectedMonth, ...payload } },
        {
          onSuccess: (saved) => {
            queryClient.invalidateQueries({ queryKey: getListMonthlyReviewsQueryKey() });
            reset(reviewToFormValues(saved));
            toast({ title: "Review saved" });
          },
          onError: () => toast({ title: "Failed to save", variant: "destructive" }),
        }
      );
    }
  };

  const isSaving = createReview.isPending || updateReview.isPending;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">Monthly Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Reflect on your progress month by month</p>
      </motion.div>

      <div className="flex items-center gap-3">
        <CalendarCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="rounded-xl flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {existingReview && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">Saved</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <motion.form
          key={selectedMonth}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >
          <div className="rounded-2xl bg-card border border-card-border p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What happened</p>

            <div className="space-y-1.5">
              <Label htmlFor="review-what-moved">What moved forward</Label>
              <Textarea
                id="review-what-moved"
                {...register("whatMoved")}
                placeholder="What made real progress this month?"
                className="rounded-xl resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-pillars-advanced">Pillars advanced</Label>
              <Textarea
                id="review-pillars-advanced"
                {...register("pillarsAdvanced")}
                placeholder="Which projects or areas made meaningful strides?"
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-milestones-completed">Milestones completed</Label>
              <Textarea
                id="review-milestones-completed"
                {...register("milestonesCompleted")}
                placeholder="Key milestones reached this month"
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-card-border p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What to learn from</p>

            <div className="space-y-1.5">
              <Label htmlFor="review-what-delayed">What caused delays</Label>
              <Textarea
                id="review-what-delayed"
                {...register("whatDelayed")}
                placeholder="What slowed you down or blocked progress?"
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-what-to-pause">What to pause</Label>
              <Textarea
                id="review-what-to-pause"
                {...register("whatToPause")}
                placeholder="What should you put on hold or let go?"
                className="rounded-xl resize-none"
                rows={2}
              />
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-card-border p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top 3 priorities next month</p>
            {(["priority1", "priority2", "priority3"] as const).map((field, i) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`review-${field}`} className="text-xs text-muted-foreground">Priority {i + 1}</Label>
                <Input
                  id={`review-${field}`}
                  {...register(field)}
                  placeholder={i === 0 ? "e.g. Launch beta to first users" : i === 1 ? "e.g. Finish the content backlog" : "e.g. Ship the onboarding flow"}
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full rounded-xl gap-2" disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : existingReview ? "Update review" : "Save review"}
          </Button>
        </motion.form>
      )}
    </div>
  );
}
