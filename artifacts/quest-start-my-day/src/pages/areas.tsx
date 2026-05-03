import { useState, useEffect, useCallback, useId } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListAreas,
  useCreateArea,
  useUpdateArea,
  useListMilestones,
  useCreateMilestone,
  useBulkCreateMilestones,
  useUpdateMilestone,
  useDeleteMilestone,
  getListAreasQueryKey,
  getGetDashboardSummaryQueryKey,
  getListMilestonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AreaSparklineWidget } from "@/components/area-sparkline";
import { PriorityBadge, PriorityHelp } from "@/components/priority-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DataLoadError } from "@/components/data-load-error";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, ChevronDown, ChevronUp, Settings, Check, Trash2, GripVertical, AlertCircle, Volume2, VolumeX, Bell, BellOff, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseList } from "@/lib/parse-list";
import { useFocusTimer, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES, clampDuration } from "@/hooks/use-focus-timer";
import { ToastAction } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PORTFOLIO_STATUSES = ["Active", "Warm", "Parked"] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

const TASK_CATEGORIES = ["business", "creative", "wellness"] as const;
type TaskCategory = typeof TASK_CATEGORIES[number];

const MILESTONE_STATUSES = ["planned", "active", "blocked", "complete"] as const;
type MilestoneStatus = typeof MILESTONE_STATUSES[number];

const milestoneStatusStyles: Record<MilestoneStatus, string> = {
  planned: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20",
  active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  blocked: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20",
  complete: "text-muted-foreground bg-muted/50",
};

interface AreaFormData {
  name: string;
  priority: string;
  description: string;
  portfolioStatus: string;
}

interface MilestoneFormData {
  title: string;
  status: string;
  priority: string;
  targetDate: string;
  description: string;
  nextAction: string;
}

function AreaForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel,
}: {
  defaultValues?: Partial<AreaFormData>;
  onSubmit: (data: AreaFormData) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const uid = useId();
  const { register, handleSubmit, setValue, watch } = useForm<AreaFormData>({
    defaultValues: {
      name: "",
      priority: "P1",
      description: "",
      portfolioStatus: "Active",
      ...defaultValues,
    },
  });
  const priority = watch("priority");
  const portfolioStatus = watch("portfolioStatus");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-name`}>Area name</Label>
        <Input id={`${uid}-name`} {...register("name", { required: true })} placeholder="e.g. Aster & Spruce Connect" className="rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={v => setValue("priority", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="P1">P1 — Must move now</SelectItem>
              <SelectItem value="P2">P2 — Important, not urgent</SelectItem>
              <SelectItem value="P3">P3 — Warm / exploratory</SelectItem>
              <SelectItem value="P4">P4 — Parked / inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Portfolio status</Label>
          <Select value={portfolioStatus} onValueChange={v => setValue("portfolioStatus", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Warm">Warm</SelectItem>
              <SelectItem value="Parked">Parked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-description`}>Description</Label>
        <Textarea id={`${uid}-description`} {...register("description")} placeholder="A short description (optional)" className="rounded-xl resize-none" rows={2} />
      </div>

      <Button type="submit" className="w-full rounded-xl" disabled={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}

function MilestoneForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel,
}: {
  defaultValues?: Partial<MilestoneFormData>;
  onSubmit: (data: MilestoneFormData) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const uid = useId();
  const { register, handleSubmit, setValue, watch } = useForm<MilestoneFormData>({
    defaultValues: {
      title: "",
      status: "planned",
      priority: "",
      targetDate: "",
      description: "",
      nextAction: "",
      ...defaultValues,
    },
  });
  const status = watch("status");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[65vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-title`}>Goal title</Label>
        <Input id={`${uid}-title`} {...register("title", { required: true })} placeholder="e.g. Launch beta to first 10 users" className="rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={v => setValue("status", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={watch("priority") || "none"} onValueChange={v => setValue("priority", v === "none" ? "" : v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
              <SelectItem value="P3">P3</SelectItem>
              <SelectItem value="P4">P4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-target-date`}>Target date (optional)</Label>
        <Input id={`${uid}-target-date`} type="date" {...register("targetDate")} className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-description`}>Description</Label>
        <Textarea id={`${uid}-description`} {...register("description")} placeholder="What does reaching this goal mean?" className="rounded-xl resize-none" rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-next-action`}>Next action</Label>
        <Input id={`${uid}-next-action`} {...register("nextAction")} placeholder="First concrete step..." className="rounded-xl" />
      </div>

      <Button type="submit" className="w-full rounded-xl" disabled={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}

const portfolioStatusStyles: Record<PortfolioStatus, string> = {
  Active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  Warm: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  Parked: "text-muted-foreground bg-muted/50",
};

function PortfolioStatusBadge({
  status,
  onStatusSelect,
  loading,
}: {
  status: string | null | undefined;
  onStatusSelect?: (s: PortfolioStatus) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const s = (status ?? "Active") as PortfolioStatus;
  const style = portfolioStatusStyles[s] ?? portfolioStatusStyles.Active;

  if (!onStatusSelect) {
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
        {s}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className={`text-xs font-medium px-2 py-0.5 rounded-full transition-opacity hover:opacity-70 active:scale-95 cursor-pointer disabled:opacity-50 ${style}`}
        >
          {s}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1 rounded-xl" align="start" side="bottom">
        {PORTFOLIO_STATUSES.map(option => {
          const optStyle = portfolioStatusStyles[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => { setOpen(false); if (option !== s) onStatusSelect(option); }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <span className={`px-1.5 py-0.5 rounded-full ${optStyle}`}>{option}</span>
              {option === s && <Check className="h-3 w-3 ml-auto text-muted-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

type MilestoneItem = {
  id: number;
  title: string;
  status: string;
  priority?: string | null;
  targetDate?: string | null;
  description?: string | null;
  nextAction?: string | null;
  sortOrder?: number | null;
  updatedAt?: string | null;
};

function SortableMilestoneRow({
  m,
  editId,
  setEditId,
  updateMilestone,
  deleteMilestone,
  handleUpdate,
  handleDelete,
}: {
  m: MilestoneItem;
  editId: number | null;
  setEditId: (id: number | null) => void;
  updateMilestone: { isPending: boolean };
  deleteMilestone: { isPending: boolean };
  handleUpdate: (id: number, data: MilestoneFormData) => void;
  handleDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-xl bg-background border border-border/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const isOverdue = m.targetDate && m.status !== "complete" && m.targetDate < today;
            return (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${milestoneStatusStyles[m.status as MilestoneStatus] ?? milestoneStatusStyles.planned}`}>
                    {m.status}
                  </span>
                  {m.priority && (
                    <span className="text-xs text-muted-foreground font-medium">{m.priority}</span>
                  )}
                  {m.targetDate && (
                    <span className="text-xs text-muted-foreground">→ {m.targetDate}</span>
                  )}
                  {isOverdue && (
                    <span className="flex items-center gap-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <AlertCircle className="h-3 w-3" />
                      Overdue
                    </span>
                  )}
                  {(() => {
                    if (m.status === "complete" || !m.updatedAt) return null;
                    const days = Math.floor((Date.now() - new Date(m.updatedAt).getTime()) / 86400000);
                    return (
                      <span className={`text-xs font-medium ${days >= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {days}d no movement
                      </span>
                    );
                  })()}
                </div>
                <p className={`text-sm font-medium text-foreground ${m.status === "complete" ? "line-through text-muted-foreground" : ""}`}>
                  {m.title}
                </p>
                {m.nextAction && (
                  <p className="text-xs text-muted-foreground mt-0.5">Next: {m.nextAction}</p>
                )}
              </>
            );
          })()}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Dialog open={editId === m.id} onOpenChange={open => setEditId(open ? m.id : null)}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label={`Edit goal: ${m.title}`}>
                <Pencil className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-sm mx-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Edit goal</DialogTitle>
                <DialogDescription className="sr-only">Update the details for this goal.</DialogDescription>
              </DialogHeader>
              <MilestoneForm
                defaultValues={{
                  title: m.title,
                  status: m.status,
                  priority: m.priority ?? "",
                  targetDate: m.targetDate ?? "",
                  description: m.description ?? "",
                  nextAction: m.nextAction ?? "",
                }}
                onSubmit={(data) => handleUpdate(m.id, data)}
                loading={updateMilestone.isPending}
                submitLabel="Save changes"
              />
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-600"
            onClick={() => handleDelete(m.id)}
            disabled={deleteMilestone.isPending}
            aria-label={`Delete goal: ${m.title}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MilestonesSection({ areaId }: { areaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: milestones, isLoading } = useListMilestones({ areaId });
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [orderedMilestones, setOrderedMilestones] = useState<MilestoneItem[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const bulkCreateMilestones = useBulkCreateMilestones();

  useEffect(() => {
    if (milestones) {
      setOrderedMilestones(milestones as MilestoneItem[]);
    }
  }, [milestones]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey({ areaId }) });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedMilestones.findIndex(m => m.id === active.id);
    const newIndex = orderedMilestones.findIndex(m => m.id === over.id);
    const reordered = arrayMove(orderedMilestones, oldIndex, newIndex);

    setOrderedMilestones(reordered);

    reordered.forEach((m, index) => {
      if (m.sortOrder !== index) {
        updateMilestone.mutate(
          { id: m.id, data: { sortOrder: index } },
          { onError: () => toast({ title: "Failed to save order", variant: "destructive" }) }
        );
      }
    });
  };

  const handleCreate = (data: MilestoneFormData) => {
    createMilestone.mutate(
      {
        data: {
          areaId,
          title: data.title,
          status: data.status as "planned" | "active" | "blocked" | "complete",
          priority: (data.priority || undefined) as "P1" | "P2" | "P3" | "P4" | undefined,
          targetDate: data.targetDate || undefined,
          description: data.description || undefined,
          nextAction: data.nextAction || undefined,
        },
      },
      {
        onSuccess: () => { invalidate(); setAddOpen(false); toast({ title: "Goal added" }); },
        onError: () => toast({ title: "Failed to add goal", variant: "destructive" }),
      }
    );
  };

  const handleBulkCreate = () => {
    const titles = parseList(bulkText, { stripBullets: false });

    if (titles.length === 0) return;

    bulkCreateMilestones.mutate(
      { data: { areaId, titles } },
      {
        onSuccess: (created) => {
          invalidate();
          setBulkOpen(false);
          setBulkText("");
          toast({ title: `${created.length} goal${created.length !== 1 ? "s" : ""} added` });
        },
        onError: () => toast({ title: "Failed to add goals", variant: "destructive" }),
      }
    );
  };

  const handleUpdate = (id: number, data: MilestoneFormData) => {
    updateMilestone.mutate(
      {
        id,
        data: {
          title: data.title,
          status: data.status as "planned" | "active" | "blocked" | "complete",
          priority: (data.priority || undefined) as "P1" | "P2" | "P3" | "P4" | undefined,
          targetDate: data.targetDate || undefined,
          description: data.description || undefined,
          nextAction: data.nextAction || undefined,
        },
      },
      {
        onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Goal updated" }); },
        onError: () => toast({ title: "Failed to update goal", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMilestone.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Goal removed" }); },
        onError: () => toast({ title: "Failed to delete goal", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-8 rounded-lg" /></div>;
  }

  const activeMilestone = milestones?.find(m => m.status === "active") ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Milestones
          </p>
          {orderedMilestones.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {orderedMilestones.filter(m => m.status === "complete").length} / {orderedMilestones.length} complete
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) setBulkText(""); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 rounded-lg gap-1 text-xs px-2">
                <Plus className="h-3 w-3" />
                Bulk add
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-sm mx-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Bulk add goals</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Type one goal title per line. They'll all be added as planned goals — you can fill in details after.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <Textarea
                  autoFocus
                  placeholder={"Build landing page\nSet up analytics\nWrite first blog post"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="rounded-xl min-h-[160px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleBulkCreate();
                    }
                  }}
                />
                {(() => {
                  const count = parseList(bulkText, { stripBullets: false }).length;
                  return count > 0 ? (
                    <p className="text-xs text-muted-foreground">{count} goal{count !== 1 ? "s" : ""} will be added</p>
                  ) : null;
                })()}
                <Button
                  className="w-full rounded-xl"
                  onClick={handleBulkCreate}
                  disabled={bulkCreateMilestones.isPending || parseList(bulkText, { stripBullets: false }).length === 0}
                >
                  {bulkCreateMilestones.isPending ? "Adding..." : (() => {
                    const count = parseList(bulkText, { stripBullets: false }).length;
                    return count > 0 ? `Add ${count} goal${count !== 1 ? "s" : ""}` : "Add goals";
                  })()}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 rounded-lg gap-1 text-xs px-2">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-sm mx-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">New goal</DialogTitle>
                <DialogDescription className="sr-only">Add a new goal to track progress for this area.</DialogDescription>
              </DialogHeader>
              <MilestoneForm
                onSubmit={handleCreate}
                loading={createMilestone.isPending}
                submitLabel="Create goal"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {activeMilestone && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/30 px-3 py-2.5">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">Active now</p>
          <p className="text-sm font-medium text-foreground">{activeMilestone.title}</p>
          {activeMilestone.nextAction && (
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">Next: {activeMilestone.nextAction}</p>
          )}
          {activeMilestone.targetDate && (
            <p className="text-xs text-muted-foreground mt-0.5">Target: {activeMilestone.targetDate}</p>
          )}
        </div>
      )}

      {(!orderedMilestones || orderedMilestones.length === 0) ? (
        <p className="text-xs text-muted-foreground/60 italic py-1">No goals yet. Add one to track progress.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedMilestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {orderedMilestones.map(m => (
                <SortableMilestoneRow
                  key={m.id}
                  m={m}
                  editId={editId}
                  setEditId={setEditId}
                  updateMilestone={updateMilestone}
                  deleteMilestone={deleteMilestone}
                  handleUpdate={handleUpdate}
                  handleDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

const featureTagStyles: Record<string, string> = {
  personal: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20",
  shared: "text-violet-700 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20",
  sellable: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
};

const featureTagLabels: Record<string, string> = {
  personal: "Personal",
  shared: "Shared",
  sellable: "Sellable",
};


interface AreaCardProps {
  area: {
    id: number;
    name: string;
    priority: string;
    description?: string | null;
    color?: string | null;
    isActiveThisWeek: boolean;
    portfolioStatus?: string | null;
  };
}

function AreaCard({ area }: AreaCardProps) {
  return (
    <div className="rounded-2xl bg-card border border-card-border">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {area.color && (
              <span className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: area.color }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-medium text-foreground">{area.name}</span>
                <PriorityBadge priority={area.priority} />
                <PriorityHelp />
              </div>
              {area.description && (
                <p className="text-xs text-muted-foreground mt-1">{area.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <AreaSparklineWidget areaId={area.id} />
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-full text-xs gap-1"
            >
              <Link
                href={`/areas/${area.id}`}
                aria-label={`Open ${area.name}`}
                data-testid={`open-area-${area.id}`}
              >
                Open
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const P_LEGEND = [
  { level: "P1", label: "Must move now", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  { level: "P2", label: "Important, not urgent", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { level: "P3", label: "Warm / exploratory", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  { level: "P4", label: "Parked / inactive", color: "bg-muted text-muted-foreground" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: areas, isLoading, isError, refetch } = useListAreas();
  const createArea = useCreateArea();
  const [addOpen, setAddOpen] = useState(false);

  const handleCreate = (data: AreaFormData) => {
    createArea.mutate(
      {
        data: {
          name: data.name,
          priority: data.priority as "P1" | "P2" | "P3" | "P4",
          description: data.description || undefined,
          isActiveThisWeek: data.portfolioStatus === "Active",
          portfolioStatus: data.portfolioStatus,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAreasQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setAddOpen(false);
          toast({ title: "Area added" });
        },
        onError: () => toast({ title: "Failed to add area", variant: "destructive" }),
      }
    );
  };

  if (isError) {
    return (
      <div className="space-y-4 pt-2">
        <DataLoadError
          title="Couldn't load your areas"
          message="We can't reach your data right now. Try again in a moment."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const activeP = areas?.filter(p => p.portfolioStatus === "Active") ?? [];
  const warmP = areas?.filter(p => p.portfolioStatus === "Warm") ?? [];
  const parkedP = areas?.filter(p => p.portfolioStatus === "Parked") ?? [];
  const ungrouped = areas?.filter(p => !p.portfolioStatus) ?? [];
  const activeThisWeek = areas?.filter(p => p.isActiveThisWeek) ?? [];

  const groups: { label: string; items: typeof activeP }[] = [
    { label: "Active", items: [...activeP, ...ungrouped] },
    { label: "Warm", items: warmP },
    { label: "Parked", items: parkedP },
  ].filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your area projects</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5">
              <Plus className="h-4 w-4" />
              Add area
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">New area project</DialogTitle>
              <DialogDescription className="sr-only">Create a new area project to organize your work.</DialogDescription>
            </DialogHeader>
            <AreaForm onSubmit={handleCreate} loading={createArea.isPending} submitLabel="Create area" />
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* "This week" — compact pill row of active-this-week areas. Hidden
          when none are active (no empty state — the brain dump below covers
          first-run). Each pill links into the per-area page. */}
      {activeThisWeek.length > 0 && (
        <section aria-labelledby="this-week-heading" className="space-y-1.5">
          <p
            id="this-week-heading"
            className="text-xs text-muted-foreground tracking-wide"
          >
            this week
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeThisWeek.map((a) => (
              <Link
                key={a.id}
                href={`/areas/${a.id}`}
                aria-label={`Open ${a.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium truncate max-w-[10rem]">{a.name}</span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  · {a.priority}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {areas?.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-2xl bg-card border border-dashed border-border">
          <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-serif text-lg font-medium text-foreground">Start with one area</p>
          <p className="text-sm text-muted-foreground mt-2 mb-4 max-w-sm mx-auto">
            Group tasks into lightweight categories like <span className="font-medium text-foreground">Operations</span>, <span className="font-medium text-foreground">Family</span>, or <span className="font-medium text-foreground">Wellness</span>. Your assistant uses areas to balance your day so nothing gets lost.
          </p>
          <Button
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => setAddOpen(true)}
            data-testid="areas-empty-cta"
          >
            <Plus className="h-4 w-4" />
            Add your first area
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group, gi) => (
            <motion.section
              key={group.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
            >
              <h2 className="font-serif text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">{group.label}</h2>
              <div className="space-y-3">
                {group.items.map(area => (
                  <AreaCard
                    key={area.id}
                    area={area}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}

    </div>
  );
}
