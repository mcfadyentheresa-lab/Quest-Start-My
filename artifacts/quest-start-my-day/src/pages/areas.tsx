import { useState, useId } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  useListAreas,
  useCreateArea,
  getListAreasQueryKey,
  getGetDashboardSummaryQueryKey,
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
import { Plus, Settings, Check, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const PORTFOLIO_STATUSES = ["Active", "Warm", "Parked"] as const;
type PortfolioStatus = typeof PORTFOLIO_STATUSES[number];

const TASK_CATEGORIES = ["business", "creative", "wellness"] as const;
type TaskCategory = typeof TASK_CATEGORIES[number];

interface AreaFormData {
  name: string;
  priority: string;
  description: string;
  portfolioStatus: string;
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
