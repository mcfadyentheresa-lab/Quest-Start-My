import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useCreateTask,
  useListAreas,
  useGetDashboardSummary,
  useListMilestones,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
  getListMilestonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  areaId: string;
  milestoneId: string;
  whyItMatters: string;
  doneLooksLike: string;
  suggestedNextStep: string;
}

export function AddTaskDialog({ date, children }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm<TaskFormData>({
    defaultValues: {
      title: "",
      areaId: "none",
      milestoneId: "none",
      whyItMatters: "",
      doneLooksLike: "",
      suggestedNextStep: "",
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();
  const { data: areas } = useListAreas();
  const { data: summary } = useGetDashboardSummary();
  const areaId = watch("areaId");
  const milestoneId = watch("milestoneId");

  const selectedAreaNumericId = areaId && areaId !== "none" ? parseInt(areaId) : undefined;

  const milestoneParams = selectedAreaNumericId ? { areaId: selectedAreaNumericId } : undefined;
  const { data: milestones } = useListMilestones(
    milestoneParams,
    {
      query: {
        queryKey: getListMilestonesQueryKey(milestoneParams),
        enabled: !!selectedAreaNumericId,
      },
    }
  );

  const activeAreas = areas?.filter(p => p.isActiveThisWeek) ?? [];

  const activeMilestones = milestones?.filter(m => m.status !== "complete" && m.status !== "blocked") ?? [];

  const onSubmit = (data: TaskFormData) => {
    createTask.mutate(
      {
        data: {
          title: data.title,
          category: "business",
          whyItMatters: data.whyItMatters || undefined,
          doneLooksLike: data.doneLooksLike || undefined,
          suggestedNextStep: data.suggestedNextStep || undefined,
          areaId: data.areaId && data.areaId !== "none" ? parseInt(data.areaId) : undefined,
          milestoneId: data.milestoneId && data.milestoneId !== "none" ? parseInt(data.milestoneId) : undefined,
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
          <DialogDescription className="sr-only">Fill in the details to add a new task for the day.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[75vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="title">Task title</Label>
            <Input id="title" {...register("title", { required: true })} placeholder="What will you do?" className="rounded-xl" />
          </div>

          {activeAreas.length > 0 && (
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select
                value={areaId}
                onValueChange={(v) => {
                  setValue("areaId", v);
                  setValue("milestoneId", "none");
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {activeAreas.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Milestone selector — only shown when a area is selected and it has milestones */}
          {selectedAreaNumericId && activeMilestones.length > 0 && (
            <div className="space-y-1.5">
              <Label>Milestone</Label>
              <Select value={milestoneId} onValueChange={(v) => setValue("milestoneId", v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="No milestone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {activeMilestones.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Weekly priority reminder */}
          {areaId && areaId !== "none" && summary?.weeklyPlan?.priorities && summary.weeklyPlan.priorities.length > 0 && (
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
