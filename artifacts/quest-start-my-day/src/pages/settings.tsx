import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListPillars,
  useCreatePillar,
  useUpdatePillar,
  useListMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  getListPillarsQueryKey,
  getGetDashboardSummaryQueryKey,
  getListMilestonesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PriorityBadge } from "@/components/priority-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, ChevronDown, ChevronUp, Settings, Check, Trash2, GripVertical, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

const COLORS = [
  "#c2a49e", "#d4a77a", "#a8b89c", "#8eafc0", "#b49ac4", "#c4947a",
];

const PORTFOLIO_STATUSES = ["Active", "Warm", "Parked"] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

const MILESTONE_STATUSES = ["planned", "active", "blocked", "complete"] as const;
type MilestoneStatus = typeof MILESTONE_STATUSES[number];

const milestoneStatusStyles: Record<MilestoneStatus, string> = {
  planned: "text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20",
  active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  blocked: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20",
  complete: "text-muted-foreground bg-muted/50",
};

interface PillarFormData {
  name: string;
  priority: string;
  description: string;
  color: string;
  portfolioStatus: string;
  featureTag: string;
  currentStage: string;
  whyItMatters: string;
  nowFocus: string;
  nextFocus: string;
  laterFocus: string;
  blockers: string;
}

interface MilestoneFormData {
  title: string;
  status: string;
  priority: string;
  targetDate: string;
  description: string;
  nextAction: string;
}

function PillarForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel,
}: {
  defaultValues?: Partial<PillarFormData>;
  onSubmit: (data: PillarFormData) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const { register, handleSubmit, setValue, watch } = useForm<PillarFormData>({
    defaultValues: {
      name: "",
      priority: "P1",
      description: "",
      color: COLORS[0],
      portfolioStatus: "Active",
      featureTag: "",
      currentStage: "",
      whyItMatters: "",
      nowFocus: "",
      nextFocus: "",
      laterFocus: "",
      blockers: "",
      ...defaultValues,
    },
  });
  const priority = watch("priority");
  const color = watch("color");
  const portfolioStatus = watch("portfolioStatus");
  const featureTag = watch("featureTag");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label>Pillar name</Label>
        <Input {...register("name", { required: true })} placeholder="e.g. Aster & Spruce Connect" className="rounded-xl" />
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
        <Label>Feature focus</Label>
        <Select value={featureTag || "none"} onValueChange={v => setValue("featureTag", v === "none" ? "" : v)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
            <SelectItem value="sellable">Sellable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register("description")} placeholder="Brief description" className="rounded-xl resize-none" rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setValue("color", c)}
              className={`h-7 w-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Project detail</p>

        <div className="space-y-1.5">
          <Label>Current stage</Label>
          <Input {...register("currentStage")} placeholder="e.g. Early development, Beta, Launched..." className="rounded-xl" />
        </div>

        <div className="space-y-1.5">
          <Label>Why it matters</Label>
          <Textarea {...register("whyItMatters")} placeholder="Why does this project matter to you?" className="rounded-xl resize-none" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Now — what you're focused on</Label>
          <Textarea {...register("nowFocus")} placeholder="What's the current focus or milestone?" className="rounded-xl resize-none" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Next — what comes after</Label>
          <Textarea {...register("nextFocus")} placeholder="What's the next phase or step?" className="rounded-xl resize-none" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Later — future ideas</Label>
          <Textarea {...register("laterFocus")} placeholder="What's in the longer-term vision?" className="rounded-xl resize-none" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Blockers</Label>
          <Textarea {...register("blockers")} placeholder="Anything blocking this project?" className="rounded-xl resize-none" rows={2} />
        </div>
      </div>

      <Button type="submit" className="w-full rounded-xl sticky bottom-0" disabled={loading}>
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
        <Label>Milestone title</Label>
        <Input {...register("title", { required: true })} placeholder="e.g. Launch beta to first 10 users" className="rounded-xl" />
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
        <Label>Target date (optional)</Label>
        <Input type="date" {...register("targetDate")} className="rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register("description")} placeholder="What does reaching this milestone mean?" className="rounded-xl resize-none" rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label>Next action</Label>
        <Input {...register("nextAction")} placeholder="First concrete step..." className="rounded-xl" />
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
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                <Pencil className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-sm mx-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Edit milestone</DialogTitle>
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
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MilestonesSection({ pillarId }: { pillarId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: milestones, isLoading } = useListMilestones({ pillarId });
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [orderedMilestones, setOrderedMilestones] = useState<MilestoneItem[]>([]);

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
    queryClient.invalidateQueries({ queryKey: getListMilestonesQueryKey({ pillarId }) });
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
          pillarId,
          title: data.title,
          status: data.status as "planned" | "active" | "blocked" | "complete",
          priority: (data.priority || undefined) as "P1" | "P2" | "P3" | "P4" | undefined,
          targetDate: data.targetDate || undefined,
          description: data.description || undefined,
          nextAction: data.nextAction || undefined,
        },
      },
      {
        onSuccess: () => { invalidate(); setAddOpen(false); toast({ title: "Milestone added" }); },
        onError: () => toast({ title: "Failed to add milestone", variant: "destructive" }),
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
        onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Milestone updated" }); },
        onError: () => toast({ title: "Failed to update milestone", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteMilestone.mutate(
      { id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Milestone removed" }); },
        onError: () => toast({ title: "Failed to delete milestone", variant: "destructive" }),
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
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 rounded-lg gap-1 text-xs px-2">
              <Plus className="h-3 w-3" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-sm mx-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">New milestone</DialogTitle>
            </DialogHeader>
            <MilestoneForm
              onSubmit={handleCreate}
              loading={createMilestone.isPending}
              submitLabel="Create milestone"
            />
          </DialogContent>
        </Dialog>
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
        <p className="text-xs text-muted-foreground/60 italic py-1">No milestones yet. Add one to track progress.</p>
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

interface PillarCardProps {
  pillar: {
    id: number;
    name: string;
    priority: string;
    description?: string | null;
    color?: string | null;
    isActiveThisWeek: boolean;
    portfolioStatus?: string | null;
    featureTag?: string | null;
    currentStage?: string | null;
    whyItMatters?: string | null;
    nowFocus?: string | null;
    nextFocus?: string | null;
    laterFocus?: string | null;
    blockers?: string | null;
  };
  onEdit: (id: number, data: PillarFormData) => void;
  onStatusChange: (id: number, status: PortfolioStatus) => void;
  editLoading: boolean;
  statusLoading: boolean;
}

function PillarCard({ pillar, onEdit, onStatusChange, editLoading, statusLoading }: PillarCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasDetail = pillar.whyItMatters || pillar.nowFocus || pillar.nextFocus || pillar.laterFocus || pillar.blockers || pillar.currentStage;

  return (
    <div className="rounded-2xl bg-card border border-card-border">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {pillar.color && (
              <span className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: pillar.color }} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-serif font-medium text-foreground">{pillar.name}</span>
                <PriorityBadge priority={pillar.priority} />
                <PortfolioStatusBadge
                  status={pillar.portfolioStatus}
                  onStatusSelect={(s) => onStatusChange(pillar.id, s)}
                  loading={statusLoading}
                />
                {pillar.featureTag && featureTagLabels[pillar.featureTag] && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${featureTagStyles[pillar.featureTag] ?? ""}`}>
                    {featureTagLabels[pillar.featureTag]}
                  </span>
                )}
              </div>
              {pillar.description && (
                <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>
              )}
              {pillar.currentStage && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 italic">Stage: {pillar.currentStage}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-md mx-4">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Edit pillar</DialogTitle>
                </DialogHeader>
                <PillarForm
                  defaultValues={{
                    name: pillar.name,
                    priority: pillar.priority,
                    description: pillar.description ?? "",
                    color: pillar.color ?? COLORS[0]!,
                    portfolioStatus: pillar.portfolioStatus ?? "Active",
                    featureTag: pillar.featureTag ?? "",
                    currentStage: pillar.currentStage ?? "",
                    whyItMatters: pillar.whyItMatters ?? "",
                    nowFocus: pillar.nowFocus ?? "",
                    nextFocus: pillar.nextFocus ?? "",
                    laterFocus: pillar.laterFocus ?? "",
                    blockers: pillar.blockers ?? "",
                  }}
                  onSubmit={(data) => { onEdit(pillar.id, data); setDialogOpen(false); }}
                  loading={editLoading}
                  submitLabel="Save changes"
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border mx-4" />
            <div className="px-4 pb-4 pt-3 space-y-3">
              {pillar.whyItMatters && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Why it matters</p>
                  <p className="text-sm text-foreground/80">{pillar.whyItMatters}</p>
                </div>
              )}
              {pillar.nowFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Now</p>
                  <p className="text-sm text-foreground/80">{pillar.nowFocus}</p>
                </div>
              )}
              {pillar.nextFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Next</p>
                  <p className="text-sm text-foreground/80">{pillar.nextFocus}</p>
                </div>
              )}
              {pillar.laterFocus && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Later</p>
                  <p className="text-sm text-foreground/80">{pillar.laterFocus}</p>
                </div>
              )}
              {pillar.blockers && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-rose-500 dark:text-rose-400 mb-1">Blockers</p>
                  <p className="text-sm text-foreground/80">{pillar.blockers}</p>
                </div>
              )}

              {/* Milestones section */}
              <div className="border-t border-border pt-3">
                <MilestonesSection pillarId={pillar.id} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const { data: pillars, isLoading } = useListPillars();
  const createPillar = useCreatePillar();
  const updatePillar = useUpdatePillar();
  const [addOpen, setAddOpen] = useState(false);

  const handleCreate = (data: PillarFormData) => {
    createPillar.mutate(
      {
        data: {
          name: data.name,
          priority: data.priority as "P1" | "P2" | "P3" | "P4",
          description: data.description || undefined,
          isActiveThisWeek: data.portfolioStatus === "Active",
          color: data.color,
          portfolioStatus: data.portfolioStatus,
          featureTag: (data.featureTag as "personal" | "shared" | "sellable") || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setAddOpen(false);
          toast({ title: "Pillar added" });
        },
        onError: () => toast({ title: "Failed to add pillar", variant: "destructive" }),
      }
    );
  };

  const handleStatusChange = (id: number, status: PortfolioStatus, previousStatus?: PortfolioStatus) => {
    const prevStatus = previousStatus ?? ((pillars?.find(p => p.id === id)?.portfolioStatus ?? "Active") as PortfolioStatus);
    updatePillar.mutate(
      {
        id,
        data: {
          portfolioStatus: status,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({
            title: `Moved to ${status}`,
            action: (
              <ToastAction
                altText="Undo status change"
                onClick={() => handleStatusChange(id, prevStatus, status)}
              >
                Undo
              </ToastAction>
            ),
          });
        },
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      }
    );
  };

  const handleEdit = (id: number, data: PillarFormData) => {
    const today = new Date().toISOString().slice(0, 10);
    updatePillar.mutate(
      {
        id,
        data: {
          name: data.name,
          priority: data.priority as "P1" | "P2" | "P3" | "P4",
          description: data.description || undefined,
          color: data.color,
          portfolioStatus: data.portfolioStatus,
          currentStage: data.currentStage || undefined,
          whyItMatters: data.whyItMatters || undefined,
          nowFocus: data.nowFocus || undefined,
          nextFocus: data.nextFocus || undefined,
          laterFocus: data.laterFocus || undefined,
          blockers: data.blockers || undefined,
          featureTag: (data.featureTag as "personal" | "shared" | "sellable") || null,
          lastUpdated: today,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Pillar updated" });
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const activeP = pillars?.filter(p => p.portfolioStatus === "Active") ?? [];
  const warmP = pillars?.filter(p => p.portfolioStatus === "Warm") ?? [];
  const parkedP = pillars?.filter(p => p.portfolioStatus === "Parked") ?? [];
  const ungrouped = pillars?.filter(p => !p.portfolioStatus) ?? [];

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
          <p className="text-sm text-muted-foreground mt-0.5">Your pillar projects</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5">
              <Plus className="h-4 w-4" />
              Add pillar
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">New pillar project</DialogTitle>
            </DialogHeader>
            <PillarForm onSubmit={handleCreate} loading={createPillar.isPending} submitLabel="Create pillar" />
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* P1-P4 legend */}
      <section className="rounded-2xl bg-card border border-card-border p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Priority guide</p>
        <div className="space-y-2">
          {P_LEGEND.map(({ level, label, color }) => (
            <div key={level} className="flex items-center gap-2.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{level}</span>
              <span className="text-sm text-foreground/70">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {pillars?.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No pillar projects yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Add your major projects to start organizing your days</p>
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
                {group.items.map(pillar => (
                  <PillarCard
                    key={pillar.id}
                    pillar={pillar}
                    onEdit={handleEdit}
                    onStatusChange={handleStatusChange}
                    editLoading={updatePillar.isPending}
                    statusLoading={updatePillar.isPending}
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
