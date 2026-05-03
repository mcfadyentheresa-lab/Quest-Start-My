import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  useUpdateTask,
  useListAreas,
  useListMilestones,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
  getListMilestonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: number;
  title: string;
  category: string;
  whyItMatters?: string | null;
  doneLooksLike?: string | null;
  suggestedNextStep?: string | null;
  blockerReason?: string | null;
  status: string;
  // null = inbox / unscheduled.
  date?: string | null;
  areaId?: number | null;
  milestoneId?: number | null;
}

interface TaskDetailSheetProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaskEditFormData {
  title: string;
  category: string;
  areaId: string;
  milestoneId: string;
  whyItMatters: string;
  doneLooksLike: string;
  suggestedNextStep: string;
  blockerReason: string;
}

export function TaskDetailSheet({ task, open, onOpenChange }: TaskDetailSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const { data: areas } = useListAreas();
  const cancelledRef = useRef(false);

  const { register, handleSubmit, reset, setValue, watch, getValues } = useForm<TaskEditFormData>({
    defaultValues: {
      title: task.title,
      category: task.category,
      areaId: task.areaId ? String(task.areaId) : "none",
      milestoneId: task.milestoneId ? String(task.milestoneId) : "none",
      whyItMatters: task.whyItMatters ?? "",
      doneLooksLike: task.doneLooksLike ?? "",
      suggestedNextStep: task.suggestedNextStep ?? "",
      blockerReason: task.blockerReason ?? "",
    },
  });

  const areaId = watch("areaId");
  const category = watch("category");
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

  useEffect(() => {
    if (open) {
      cancelledRef.current = false;
      reset({
        title: task.title,
        category: task.category,
        areaId: task.areaId ? String(task.areaId) : "none",
        milestoneId: task.milestoneId ? String(task.milestoneId) : "none",
        whyItMatters: task.whyItMatters ?? "",
        doneLooksLike: task.doneLooksLike ?? "",
        suggestedNextStep: task.suggestedNextStep ?? "",
        blockerReason: task.blockerReason ?? "",
      });
    }
  }, [open, task, reset]);

  const invalidateAll = () => {
    if (task.date) {
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: task.date }) });
    }
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
  };

  const saveData = (data: TaskEditFormData, silent = false) => {
    updateTask.mutate(
      {
        id: task.id,
        data: {
          title: data.title.trim() || task.title,
          category: data.category as "business" | "creative" | "wellness",
          areaId: data.areaId && data.areaId !== "none" ? parseInt(data.areaId) : null,
          milestoneId: data.milestoneId && data.milestoneId !== "none" ? parseInt(data.milestoneId) : null,
          whyItMatters: data.whyItMatters.trim() || null,
          doneLooksLike: data.doneLooksLike.trim() || null,
          suggestedNextStep: data.suggestedNextStep.trim() || null,
          blockerReason: task.status === "blocked" ? (data.blockerReason.trim() || null) : undefined,
        },
      },
      {
        onSuccess: () => {
          invalidateAll();
          if (!silent) toast({ title: "Task updated" });
        },
        onError: () => {
          toast({ title: "Failed to save changes", variant: "destructive" });
        },
      }
    );
  };

  const onSubmit = (data: TaskEditFormData) => {
    saveData(data);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !cancelledRef.current) {
      saveData(getValues(), true);
    }
    cancelledRef.current = false;
    onOpenChange(nextOpen);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-6 pb-8">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-serif text-xl text-left">Edit task</SheetTitle>
          <SheetDescription className="sr-only">
            Edit the details of this task, including its title, category, area, goal, and other fields.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="detail-title">Title</Label>
            <Input
              id="detail-title"
              {...register("title", { required: true })}
              className="rounded-xl"
            />
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

            {areas && areas.length > 0 && (
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
                    {areas.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {selectedAreaNumericId && (
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Select
                value={milestoneId}
                onValueChange={(v) => setValue("milestoneId", v)}
                disabled={!milestones || milestones.length === 0}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="No goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No goal</SelectItem>
                  {milestones?.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="detail-why">Why this matters</Label>
            <Textarea
              id="detail-why"
              {...register("whyItMatters")}
              placeholder="Why is this important?"
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="detail-done">Done looks like</Label>
            <Textarea
              id="detail-done"
              {...register("doneLooksLike")}
              placeholder="What does completion look like?"
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="detail-next">Suggested next step</Label>
            <Input
              id="detail-next"
              {...register("suggestedNextStep")}
              placeholder="Optional first action"
              className="rounded-xl"
            />
          </div>

          {task.status === "blocked" && (
            <div className="space-y-1.5">
              <Label htmlFor="detail-blocker">Blocker reason</Label>
              <Textarea
                id="detail-blocker"
                {...register("blockerReason")}
                placeholder="What's blocking this?"
                className="rounded-xl resize-none border-rose-200 dark:border-rose-800"
                rows={2}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl"
              disabled={updateTask.isPending}
            >
              Save changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
