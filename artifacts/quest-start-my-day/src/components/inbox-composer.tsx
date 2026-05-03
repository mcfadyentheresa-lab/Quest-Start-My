import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import {
  useCreateTask,
  useListAreas,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
  getListAreaTasksQueryKey,
  getGetTaskInboxQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseList } from "@/lib/parse-list";

type WhenChoice = "today" | "week" | "later";

const WHEN_LABEL: Record<WhenChoice, string> = {
  today: "Today",
  week: "This week",
  later: "Later",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function dateForWhen(when: WhenChoice): string | null {
  if (when === "today") return todayIso();
  if (when === "week") return weekStartIso();
  // "later" parks the task in the inbox (no date) so the user can
  // triage it later from /inbox. Previously we picked today+30, which
  // hid the task on a faraway day and made it feel lost.
  return null;
}

export function InboxComposer() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [when, setWhen] = useState<WhenChoice>("later");
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [whenPickerOpen, setWhenPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const queryClient = useQueryClient();
  const { data: areas } = useListAreas();
  const createTask = useCreateTask();

  const lines = parseList(text);
  const canSave = lines.length > 0 && !submitting;

  useEffect(() => {
    if (!open) return;
    // Focus shortly after expand animation starts
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const reset = () => {
    setText("");
    setAreaId(null);
    setWhen("later");
  };

  const close = () => {
    setOpen(false);
    setAreaPickerOpen(false);
    setWhenPickerOpen(false);
    reset();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    const date = dateForWhen(when);
    const titles = lines;
    const results = await Promise.allSettled(
      titles.map((title) =>
        createTask.mutateAsync({
          data: {
            title,
            category: "business",
            areaId: areaId ?? undefined,
            date,
          },
        })
      )
    );
    setSubmitting(false);
    const ok = results.filter((r) => r.status === "fulfilled").length;

    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskInboxQueryKey() });
    if (areaId) {
      queryClient.invalidateQueries({ queryKey: getListAreaTasksQueryKey(areaId) });
    }

    if (ok === 0) {
      setConfirmation("Nothing saved. Try again.");
    } else {
      setConfirmation(`Saved ${ok}.`);
      reset();
    }

    setTimeout(() => {
      setConfirmation(null);
      setOpen(false);
    }, 1200);
  };

  const selectedArea = areaId != null ? areas?.find((a) => a.id === areaId) : null;
  const areaLabel = selectedArea ? selectedArea.name : "(no area)";

  return (
    <div
      className="fixed right-4 bottom-[calc(var(--bottom-nav-height,64px)+16px)] z-40 pointer-events-none"
      style={{ ["--bottom-nav-height" as string]: "64px" }}
    >
      <AnimatePresence initial={false} mode="wait">
        {!open ? (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            aria-label="Open inbox composer"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Inbox
          </motion.button>
        ) : (
          <motion.div
            key="composer"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-[min(92vw,22rem)] rounded-2xl bg-card border border-card-border shadow-xl p-3 space-y-2"
            role="dialog"
            aria-label="Inbox composer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Inbox</span>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Drop it. One per line works."
              className="rounded-xl resize-none text-sm"
              rows={4}
              disabled={submitting}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Popover open={areaPickerOpen} onOpenChange={setAreaPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
                    aria-label="Choose area"
                  >
                    <span className="text-muted-foreground">Area:</span>
                    <span className="font-medium">{areaLabel}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="w-56 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAreaId(null);
                      setAreaPickerOpen(false);
                    }}
                    className={`w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 ${
                      areaId == null ? "bg-muted/40 font-medium" : ""
                    }`}
                  >
                    (no area)
                  </button>
                  {(areas ?? []).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setAreaId(a.id);
                        setAreaPickerOpen(false);
                      }}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 flex items-center gap-2 ${
                        areaId === a.id ? "bg-muted/40 font-medium" : ""
                      }`}
                    >
                      {a.color && (
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: a.color }}
                        />
                      )}
                      <span className="truncate">{a.name}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover open={whenPickerOpen} onOpenChange={setWhenPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
                    aria-label="Choose when"
                  >
                    <span className="text-muted-foreground">When:</span>
                    <span className="font-medium">{WHEN_LABEL[when]}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="w-40 p-1">
                  {(["today", "week", "later"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setWhen(opt);
                        setWhenPickerOpen(false);
                      }}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60 ${
                        when === opt ? "bg-muted/40 font-medium" : ""
                      }`}
                    >
                      {WHEN_LABEL[opt]}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground">
                {confirmation ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> {confirmation}
                  </span>
                ) : lines.length > 1 ? (
                  `${lines.length} items`
                ) : (
                  ""
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={close}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  Save
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
