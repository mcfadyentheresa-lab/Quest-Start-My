import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { CalendarCheck, Save, Clock, ChevronRight, ArrowLeft, Target, Search, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReviewFormData {
  whatMoved: string;
  areasAdvanced: string;
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
    areasAdvanced: review.areasAdvanced ?? "",
    milestonesCompleted: review.milestonesCompleted ?? "",
    whatDelayed: review.whatDelayed ?? "",
    whatToPause: review.whatToPause ?? "",
    priority1: p1,
    priority2: p2,
    priority3: p3,
  };
}

function truncate(text: string | null | undefined, maxLen = 120): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen).trimEnd() + "…" : text;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function reviewMatchesQuery(review: MonthlyReview, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const fields = [
    review.whatMoved,
    review.areasAdvanced,
    review.milestonesCompleted,
    review.whatDelayed,
    review.whatToPause,
    ...(review.topPrioritiesNextMonth ?? []),
  ];
  return fields.some(f => f && f.toLowerCase().includes(q));
}

interface ReviewHistoryCardProps {
  review: MonthlyReview;
  onOpen: (monthOf: string) => void;
  searchQuery: string;
}

function ReviewHistoryCard({ review, onOpen, searchQuery }: ReviewHistoryCardProps) {
  const priorities = (review.topPrioritiesNextMonth ?? []).filter(Boolean);
  const hasSummary = !!review.whatMoved;
  const hasPriorities = priorities.length > 0;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(review.monthOf)}
      className="w-full text-left rounded-2xl bg-card border border-card-border p-4 space-y-3 hover:bg-accent/50 transition-colors group"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-foreground">{formatMonth(review.monthOf)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      {hasSummary && (
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">What moved forward</p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            <HighlightedText text={truncate(review.whatMoved)} query={searchQuery} />
          </p>
        </div>
      )}

      {hasPriorities && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top priorities set</p>
          <ul className="space-y-1">
            {priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary/60" />
                <span><HighlightedText text={p} query={searchQuery} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasSummary && !hasPriorities && (
        <p className="text-sm text-muted-foreground italic">No details recorded</p>
      )}
    </motion.button>
  );
}

function ReviewHistoryView({ reviews, onSelectMonth }: { reviews: MonthlyReview[]; onSelectMonth: (m: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const sorted = [...reviews].sort((a, b) => b.monthOf.localeCompare(a.monthOf));
  const filtered = sorted.filter(r => reviewMatchesQuery(r, searchQuery));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <Clock className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No reviews saved yet.</p>
        <p className="text-xs text-muted-foreground/70">Complete your first monthly review to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search reviews…"
          className="w-full rounded-xl border border-input bg-background pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Search className="h-7 w-7 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No reviews match "{searchQuery}"</p>
        </div>
      ) : (
        filtered.map((review) => (
          <ReviewHistoryCard key={review.id} review={review} onOpen={onSelectMonth} searchQuery={searchQuery} />
        ))
      )}
    </div>
  );
}

export default function ReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const months = getRecentMonths();
  const currentMonth = months[0]!;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [pendingMonth, setPendingMonth] = useState<string | null>(null);
  const [view, setView] = useState<"form" | "history">("form");

  const { data: reviews, isLoading } = useListMonthlyReviews();
  const createReview = useCreateMonthlyReview();
  const updateReview = useUpdateMonthlyReview();

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<ReviewFormData>({
    defaultValues: {
      whatMoved: "",
      areasAdvanced: "",
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
        areasAdvanced: "",
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
      areasAdvanced: data.areasAdvanced || null,
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

  function handleMonthChange(month: string) {
    if (isDirty) {
      setPendingMonth(month);
    } else {
      setSelectedMonth(month);
    }
  }

  function confirmMonthChange() {
    if (pendingMonth) {
      setSelectedMonth(pendingMonth);
      setPendingMonth(null);
    }
  }

  function cancelMonthChange() {
    setPendingMonth(null);
  }

  const handleSelectFromHistory = (monthOf: string) => {
    setSelectedMonth(monthOf);
    setView("form");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">Monthly Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Reflect on your progress month by month</p>
        </div>
        <button
          type="button"
          onClick={() => setView(v => v === "form" ? "history" : "form")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 flex-shrink-0"
        >
          {view === "form" ? (
            <>
              <Clock className="h-3.5 w-3.5" />
              History
            </>
          ) : (
            <>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </>
          )}
        </button>
      </motion.div>

      <AnimatePresence mode="wait">
        {view === "history" ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
          >
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            ) : (
              <ReviewHistoryView reviews={reviews ?? []} onSelectMonth={handleSelectFromHistory} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
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
                    <Label htmlFor="review-areas-advanced">Areas advanced</Label>
                    <Textarea
                      id="review-areas-advanced"
                      {...register("areasAdvanced")}
                      placeholder="Which areas made meaningful strides?"
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
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={pendingMonth !== null} onOpenChange={(open) => { if (!open) cancelMonthChange(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this review. If you switch months now, your edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelMonthChange}>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMonthChange}>Leave anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
