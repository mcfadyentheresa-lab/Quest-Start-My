import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListPillars, useCreatePillar, useUpdatePillar, getListPillarsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PriorityBadge } from "@/components/priority-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const COLORS = [
  "#c2a49e", "#d4a77a", "#a8b89c", "#8eafc0", "#b49ac4", "#c4947a",
];

const PORTFOLIO_STATUSES = ["Active", "Warm", "Parked"] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

interface PillarFormData {
  name: string;
  priority: string;
  description: string;
  color: string;
  portfolioStatus: string;
  currentStage: string;
  whyItMatters: string;
  nowFocus: string;
  nextFocus: string;
  laterFocus: string;
  blockers: string;
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

const portfolioStatusStyles: Record<PortfolioStatus, string> = {
  Active: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20",
  Warm: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  Parked: "text-muted-foreground bg-muted/50",
};

function PortfolioStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "Active") as PortfolioStatus;
  const style = portfolioStatusStyles[s] ?? portfolioStatusStyles.Active;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
      {s}
    </span>
  );
}

interface PillarCardProps {
  pillar: {
    id: number;
    name: string;
    priority: string;
    description?: string | null;
    color?: string | null;
    isActiveThisWeek: boolean;
    portfolioStatus?: string | null;
    currentStage?: string | null;
    whyItMatters?: string | null;
    nowFocus?: string | null;
    nextFocus?: string | null;
    laterFocus?: string | null;
    blockers?: string | null;
  };
  onEdit: (id: number) => void;
  editId: number | null;
}

function PillarCard({ pillar, onEdit, editId }: PillarCardProps) {
  const [expanded, setExpanded] = useState(false);
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
                <PortfolioStatusBadge status={pillar.portfolioStatus} />
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
            {hasDetail && (
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Dialog open={editId === pillar.id} onOpenChange={open => onEdit(open ? pillar.id : -1)}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && hasDetail && (
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
  const [editId, setEditId] = useState<number>(-1);

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
          lastUpdated: today,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setEditId(-1);
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
                  <div key={pillar.id}>
                    <PillarCard
                      pillar={pillar}
                      onEdit={(id) => setEditId(id)}
                      editId={editId}
                    />
                    {/* Edit dialog rendered per pillar */}
                    <Dialog open={editId === pillar.id} onOpenChange={open => setEditId(open ? pillar.id : -1)}>
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
                            currentStage: pillar.currentStage ?? "",
                            whyItMatters: pillar.whyItMatters ?? "",
                            nowFocus: pillar.nowFocus ?? "",
                            nextFocus: pillar.nextFocus ?? "",
                            laterFocus: pillar.laterFocus ?? "",
                            blockers: pillar.blockers ?? "",
                          }}
                          onSubmit={data => handleEdit(pillar.id, data)}
                          loading={updatePillar.isPending}
                          submitLabel="Save changes"
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
