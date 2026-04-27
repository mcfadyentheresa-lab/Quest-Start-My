import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Zap, Clock, Shuffle, CheckCircle2, Pause, ChevronDown, ChevronUp,
  Sparkles, Timer, Wind,
} from "lucide-react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, getListTasksQueryKey, getGetDashboardSummaryQueryKey, type ListTasksParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getUserToday } from "@/lib/time";
import {
  HOME_MICROTASKS, SPRINT_PRESETS, pickMicroTasks,
  type HomeMicroTask, type EnergyLevel, type HomeArea,
} from "@/data/home-microtasks";

const AREA_LABELS: Record<HomeArea, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  laundry: "Laundry",
  living: "Living area",
  bedroom: "Bedroom",
  general: "General reset",
};

const ENERGY_CONFIG: Record<EnergyLevel, { label: string; icon: typeof Zap; className: string; activeClass: string }> = {
  low: {
    label: "Low energy",
    icon: Wind,
    className: "border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/20",
    activeClass: "bg-sky-100 border-sky-400 text-sky-700 dark:bg-sky-900/40 dark:border-sky-500 dark:text-sky-300",
  },
  medium: {
    label: "Medium energy",
    icon: Zap,
    className: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20",
    activeClass: "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/40 dark:border-amber-500 dark:text-amber-300",
  },
  high: {
    label: "High energy",
    icon: Zap,
    className: "border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20",
    activeClass: "bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/40 dark:border-orange-500 dark:text-orange-300",
  },
};

const TIME_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 2, label: "2 min" },
  { minutes: 5, label: "5 min" },
  { minutes: 10, label: "10 min" },
  { minutes: 15, label: "15 min" },
];

interface HomeTaskCardProps {
  task: { id: number; title: string; status: string; whyItMatters?: string | null; doneLooksLike?: string | null; suggestedNextStep?: string | null; date: string };
  date: string;
}

function HomeTaskCard({ task, date }: HomeTaskCardProps) {
  const [expanded, setExpanded] = useState(task.status === "pending");
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date, source: "home" }) });
  };

  const statusClass =
    task.status === "done" ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10" :
    task.status === "passed" ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/10" :
    "border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-900/10";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border-2 p-4 transition-all duration-200 ${statusClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {task.status !== "pending" && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${
              task.status === "done" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
              "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
            }`}>
              {task.status === "done" ? "Done" : "Passed"}
            </span>
          )}
          <h4 className={`font-serif text-base font-medium leading-snug mt-0.5 ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </h4>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
          aria-label={expanded ? "Collapse task details" : "Expand task details"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              {task.whyItMatters && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Why this matters</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.whyItMatters}</p>
                </div>
              )}
              {task.doneLooksLike && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Done looks like</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.doneLooksLike}</p>
                </div>
              )}
              {task.suggestedNextStep && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Suggested next step</p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{task.suggestedNextStep}</p>
                </div>
              )}
            </div>
            {task.status === "pending" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium"
                  onClick={() => updateTask.mutate({ id: task.id, data: { status: "done" } }, { onSuccess: invalidate })}
                  disabled={updateTask.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Done
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-medium"
                  onClick={() => updateTask.mutate({ id: task.id, data: { status: "passed" } }, { onSuccess: invalidate })}
                  disabled={updateTask.isPending}
                >
                  <Pause className="h-3.5 w-3.5 mr-1.5" />
                  Pass
                </Button>
              </div>
            )}
            {task.status !== "pending" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  onClick={() => updateTask.mutate({ id: task.id, data: { status: "pending" } }, { onSuccess: invalidate })}
                >
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-xs text-muted-foreground"
                  onClick={() => deleteTask.mutate({ id: task.id }, { onSuccess: invalidate })}
                >
                  Remove
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MicroTaskPreview({ microTask, onAdd, isAdding }: { microTask: HomeMicroTask; onAdd: () => void; isAdding: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-teal-200 bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/10 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              {AREA_LABELS[microTask.area]}
            </span>
            <span className="text-xs text-muted-foreground">{microTask.timeMinutes} min</span>
          </div>
          <h4 className="font-serif text-base font-medium leading-snug text-foreground">{microTask.title}</h4>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-1"
          aria-label={expanded ? "Collapse task preview" : "Expand task preview"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="preview-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Why this matters</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{microTask.whyItMatters}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Done looks like</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{microTask.doneLooksLike}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Suggested next step</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{microTask.suggestedNextStep}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3">
        <Button
          className="rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium w-full"
          onClick={onAdd}
          disabled={isAdding}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Add to today
        </Button>
      </div>
    </motion.div>
  );
}

export default function HomeModulePage() {
  const today = getUserToday();
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(null);
  const [area, setArea] = useState<HomeArea | null>(null);
  const [previews, setPreviews] = useState<HomeMicroTask[]>([]);
  const [seed, setSeed] = useState(Date.now());

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();

  const homeParams: ListTasksParams = { date: today, source: "home" };

  const { data: homeTasks, isLoading: tasksLoading } = useListTasks(
    homeParams,
    { query: { queryKey: getListTasksQueryKey(homeParams) } }
  );

  const pendingHome = homeTasks?.filter(t => t.status === "pending") ?? [];
  const completedHome = homeTasks?.filter(t => t.status !== "pending") ?? [];

  const invalidateHome = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(homeParams) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handlePickTask = () => {
    const picked = pickMicroTasks(
      HOME_MICROTASKS,
      { energy: energy ?? undefined, maxMinutes: maxMinutes ?? undefined, area: area ?? undefined },
      1,
      seed,
    );
    setPreviews(picked);
    setSeed(Date.now());
  };

  const handleSprintMode = (preset: keyof typeof SPRINT_PRESETS) => {
    const { energyFilter, maxTimePerTask, count } = SPRINT_PRESETS[preset];
    const picked = pickMicroTasks(HOME_MICROTASKS, { energy: energyFilter, maxMinutes: maxTimePerTask }, count, Date.now());
    setPreviews(picked);
  };

  const handleAddTask = (microTask: HomeMicroTask) => {
    createTask.mutate(
      {
        data: {
          title: microTask.title,
          category: "wellness",
          whyItMatters: microTask.whyItMatters,
          doneLooksLike: microTask.doneLooksLike,
          suggestedNextStep: microTask.suggestedNextStep,
          date: today,
          taskSource: "home",
        },
      },
      {
        onSuccess: () => {
          invalidateHome();
          setPreviews(prev => prev.filter(p => p.id !== microTask.id));
          toast({ title: "Added to today", description: microTask.title });
        },
        onError: () => {
          toast({ title: "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const completedCount = completedHome.filter(t => t.status === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Home className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h1 className="font-serif text-2xl font-medium text-foreground">Home Reset</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Small, concrete home tasks that lower the activation energy to start. Pick one, do it, feel better.
        </p>
        {completedCount > 0 && (
          <p className="text-sm text-teal-600 dark:text-teal-400 font-medium mt-1">
            {completedCount} task{completedCount > 1 ? "s" : ""} completed today
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Your energy right now</p>
          <div className="flex gap-2 flex-wrap">
            {(["low", "medium", "high"] as EnergyLevel[]).map(e => {
              const cfg = ENERGY_CONFIG[e];
              const Icon = cfg.icon;
              const isActive = energy === e;
              return (
                <button
                  key={e}
                  onClick={() => setEnergy(prev => prev === e ? null : e)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors font-medium ${isActive ? cfg.activeClass : cfg.className}`}
                  aria-pressed={isActive}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Time available</p>
          <div className="flex gap-2 flex-wrap">
            {TIME_OPTIONS.map(({ minutes, label }) => {
              const isActive = maxMinutes === minutes;
              return (
                <button
                  key={minutes}
                  onClick={() => setMaxMinutes(prev => prev === minutes ? null : minutes)}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    isActive
                      ? "bg-teal-100 border-teal-400 text-teal-700 dark:bg-teal-900/40 dark:border-teal-500 dark:text-teal-300"
                      : "border-border text-muted-foreground hover:border-teal-300 hover:text-teal-600"
                  }`}
                  aria-pressed={isActive}
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Area (optional)</p>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.entries(AREA_LABELS) as [HomeArea, string][]).map(([key, label]) => {
              const isActive = area === key;
              return (
                <button
                  key={key}
                  onClick={() => setArea(prev => prev === key ? null : key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isActive
                      ? "bg-teal-100 border-teal-400 text-teal-700 dark:bg-teal-900/40 dark:border-teal-500 dark:text-teal-300"
                      : "border-border text-muted-foreground hover:border-teal-300 hover:text-teal-600"
                  }`}
                  aria-pressed={isActive}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-medium"
          onClick={handlePickTask}
        >
          <Shuffle className="h-4 w-4 mr-2" />
          Pick a task for me
        </Button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Quick-start modes</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleSprintMode("fiveMinuteReset")}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-border hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-700 dark:hover:bg-teal-900/10 transition-colors text-center"
          >
            <Timer className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-semibold text-foreground">5-min reset</span>
            <span className="text-[10px] text-muted-foreground leading-tight">3 tiny tasks</span>
          </button>
          <button
            onClick={() => handleSprintMode("tenMinuteSprint")}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-border hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-700 dark:hover:bg-amber-900/10 transition-colors text-center"
          >
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-foreground">10-min sprint</span>
            <span className="text-[10px] text-muted-foreground leading-tight">3 medium tasks</span>
          </button>
          <button
            onClick={() => handleSprintMode("oneSongCleanup")}
            className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-border hover:border-violet-300 hover:bg-violet-50/50 dark:hover:border-violet-700 dark:hover:bg-violet-900/10 transition-colors text-center"
          >
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-semibold text-foreground">One song</span>
            <span className="text-[10px] text-muted-foreground leading-tight">1 focused task</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {previews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {previews.length === 1 ? "Suggested task" : `${previews.length} suggested tasks`}
            </p>
            {previews.map(mt => (
              <MicroTaskPreview
                key={mt.id}
                microTask={mt}
                onAdd={() => handleAddTask(mt)}
                isAdding={createTask.isPending}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {(pendingHome.length > 0 || completedHome.length > 0) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Today's home tasks</p>
          <AnimatePresence>
            {pendingHome.map(task => (
              <HomeTaskCard key={task.id} task={task} date={today} />
            ))}
            {completedHome.map(task => (
              <HomeTaskCard key={task.id} task={task} date={today} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {!tasksLoading && pendingHome.length === 0 && completedHome.length === 0 && previews.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Home className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No home tasks yet today.</p>
          <p className="text-xs mt-1">Pick your energy level above and tap "Pick a task for me".</p>
        </div>
      )}
    </div>
  );
}
