import { useState } from "react";
import { motion } from "framer-motion";
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
import { Plus, Pencil, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const COLORS = [
  "#c2a49e", "#d4a77a", "#a8b89c", "#8eafc0", "#b49ac4", "#c4947a",
];

interface PillarFormData {
  name: string;
  priority: string;
  description: string;
  color: string;
}

function PillarForm({
  defaultValues,
  onSubmit,
  loading,
  submitLabel,
}: {
  defaultValues?: PillarFormData;
  onSubmit: (data: PillarFormData) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const { register, handleSubmit, setValue, watch } = useForm<PillarFormData>({
    defaultValues: defaultValues ?? { name: "", priority: "P1", description: "", color: COLORS[0] },
  });
  const priority = watch("priority");
  const color = watch("color");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
      <div className="space-y-1.5">
        <Label>Pillar name</Label>
        <Input {...register("name", { required: true })} placeholder="e.g. Aster & Spruce Connect" className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={v => setValue("priority", v)}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="P1">P1 — Highest</SelectItem>
            <SelectItem value="P2">P2 — High</SelectItem>
            <SelectItem value="P3">P3 — Medium</SelectItem>
            <SelectItem value="P4">P4 — Low</SelectItem>
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
      <Button type="submit" className="w-full rounded-xl" disabled={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: pillars, isLoading } = useListPillars();
  const createPillar = useCreatePillar();
  const updatePillar = useUpdatePillar();
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const handleCreate = (data: PillarFormData) => {
    createPillar.mutate(
      { data: { name: data.name, priority: data.priority as "P1"|"P2"|"P3"|"P4", description: data.description || undefined, isActiveThisWeek: true, color: data.color } },
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
    updatePillar.mutate(
      { id, data: { name: data.name, priority: data.priority as "P1"|"P2"|"P3"|"P4", description: data.description || undefined, color: data.color } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPillarsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setEditId(null);
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

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">Pillar Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your major areas of focus</p>
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

      {pillars?.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-card border border-dashed border-border">
          <Settings className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No pillar projects yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Add your major projects to start organizing your days</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pillars?.map((pillar, i) => (
            <motion.div
              key={pillar.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-card border border-card-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {pillar.color && (
                    <span className="h-3 w-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: pillar.color }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif font-medium text-foreground">{pillar.name}</span>
                      <PriorityBadge priority={pillar.priority} />
                      {pillar.isActiveThisWeek && (
                        <span className="text-xs text-accent font-medium">Active this week</span>
                      )}
                    </div>
                    {pillar.description && (
                      <p className="text-xs text-muted-foreground mt-1">{pillar.description}</p>
                    )}
                  </div>
                </div>
                <Dialog open={editId === pillar.id} onOpenChange={open => setEditId(open ? pillar.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl flex-shrink-0">
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
                      }}
                      onSubmit={data => handleEdit(pillar.id, data)}
                      loading={updatePillar.isPending}
                      submitLabel="Save changes"
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
