import { useState } from "react";
import { useForm } from "react-hook-form";
import { useCreateTask, useListPillars, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTasksQueryKey, getGetDashboardSummaryQueryKey, getGetReentryTaskQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddTaskDialogProps {
  date: string;
  children?: React.ReactNode;
}

interface TaskFormData {
  title: string;
  category: string;
  pillarId: string;
  whyItMatters: string;
  doneLooksLike: string;
  suggestedNextStep: string;
}

export function AddTaskDialog({ date, children }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm<TaskFormData>({
    defaultValues: { title: "", category: "business", pillarId: "", whyItMatters: "", doneLooksLike: "", suggestedNextStep: "" },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();
  const { data: pillars } = useListPillars();
  const { data: summary } = useGetDashboardSummary();
  const category = watch("category");
  const pillarId = watch("pillarId");

  // Only show pillars that are active this week in the selector
  const activePillars = pillars?.filter(p => p.isActiveThisWeek) ?? [];

  const onSubmit = (data: TaskFormData) => {
    createTask.mutate(
      {
        data: {
          title: data.title,
          category: data.category as "business" | "creative" | "wellness",
          whyItMatters: data.whyItMatters || undefined,
          doneLooksLike: data.doneLooksLike || undefined,
          suggestedNextStep: data.suggestedNextStep || undefined,
          pillarId: data.pillarId ? parseInt(data.pillarId) : undefined,
          date,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
          setOpen(false);
          reset();
          toast({ title: "Task added" });
        },
        onError: () => {
          toast({ title: "Failed to add task", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-md mx-4">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add a task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[75vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Task title</Label>
            <Input id="title" {...register("title", { required: true })} placeholder="What will you do?" className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="wellness">Wellness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activePillars.length > 0 && (
              <div className="space-y-1.5">
                <Label>Pillar</Label>
                <Select value={pillarId} onValueChange={(v) => setValue("pillarId", v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {activePillars.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Show the weekly priority reminder if a pillar is selected */}
          {pillarId && summary?.weeklyPlan?.priorities && summary.weeklyPlan.priorities.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">This week's priorities</p>
              <ul className="space-y-1">
                {summary.weeklyPlan.priorities.map((p, i) => (
                  <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                    <span className="text-primary font-bold mt-0.5">·</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="why">Why this matters</Label>
            <Textarea id="why" {...register("whyItMatters")} placeholder="Why is this important today?" className="rounded-xl resize-none" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="done">Done looks like</Label>
            <Textarea id="done" {...register("doneLooksLike")} placeholder="What does completion look like?" className="rounded-xl resize-none" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Suggested next step</Label>
            <Input id="next" {...register("suggestedNextStep")} placeholder="Optional first action" className="rounded-xl" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-xl" disabled={createTask.isPending}>
              Add task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
