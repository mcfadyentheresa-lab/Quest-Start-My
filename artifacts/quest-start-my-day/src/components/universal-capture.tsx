/**
 * Universal Capture — one floating "+" on every page, one sheet, one
 * write path. Replaces the older InboxComposer + the area-detail
 * "+ Add task" + the today-page "Add my own" link.
 *
 * Behavior:
 *   - Opens a sheet bottom-right with a textarea, when picker
 *     (Today / Later, default Later), and area picker (auto-defaulted
 *     to the current page's area when one is in scope).
 *   - Posts to POST /api/capture. Server decides whether to call AI
 *     based on text length; we just send the raw text.
 *   - On success the sheet shows a brief confirmation, invalidates
 *     today/inbox/area/dashboard queries, and closes.
 *
 * What this is NOT:
 *   - A multi-line bulk creator. The old composer split lines because
 *     there was no AI. With AI cleaning, each capture should be one
 *     coherent thought. If a user wants to add five things they open
 *     the sheet five times — Save & open another keeps the flow fast.
 *
 * Voice: chief-of-staff. No emojis. Neutral pronouns.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";
import {
  useCreateCapture,
  useListAreas,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReentryTaskQueryKey,
  getListAreaTasksQueryKey,
  getGetTaskInboxQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type WhenChoice = "today" | "later";

const WHEN_LABEL: Record<WhenChoice, string> = {
  today: "Today",
  later: "Later",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Hook: figure out whether the user is currently on an area-detail
 * page, and if so what areaId. Used to default the area picker so the
 * user doesn't have to click it.
 */
function useCurrentAreaId(): number | null {
  const [match, params] = useRoute<{ id: string }>("/areas/:id");
  if (!match) return null;
  const n = Number(params?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function UniversalCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [when, setWhen] = useState<WhenChoice>("later");
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [whenPickerOpen, setWhenPickerOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const queryClient = useQueryClient();
  const { data: areas } = useListAreas();
  const captureMutation = useCreateCapture();
  const currentAreaId = useCurrentAreaId();

  // Default the area picker to the current page's area when one is in
  // scope. The user can always override.
  useEffect(() => {
    if (open && areaId == null && currentAreaId != null) {
      setAreaId(currentAreaId);
    }
    // Only run when sheet first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !captureMutation.isPending;

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ date: todayIso() }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetReentryTaskQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskInboxQueryKey() });
    if (areaId != null) {
      queryClient.invalidateQueries({ queryKey: getListAreaTasksQueryKey(areaId) });
    }
  };

  const submit = async (closeAfter: boolean) => {
    if (!canSave) return;
    try {
      await captureMutation.mutateAsync({
        data: {
          text: trimmed,
          when,
          areaId: areaId ?? undefined,
        },
      });
      invalidate();
      setConfirmation("Captured.");
      if (closeAfter) {
        setTimeout(() => {
          setConfirmation(null);
          close();
        }, 700);
      } else {
        // Save & add another: clear text, keep area + when choices,
        // refocus.
        setText("");
        setTimeout(() => {
          setConfirmation(null);
          textareaRef.current?.focus();
        }, 700);
      }
    } catch (err) {
      setConfirmation(
        err instanceof Error ? `Couldn't save: ${err.message}` : "Couldn't save.",
      );
      setTimeout(() => setConfirmation(null), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter saves and closes.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit(true);
    }
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
            aria-label="Capture an idea"
            data-testid="universal-capture-button"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Capture
          </motion.button>
        ) : (
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto w-[min(92vw,24rem)] rounded-2xl bg-card border border-card-border shadow-xl p-3 space-y-2"
            role="dialog"
            aria-label="Capture an idea"
            data-testid="universal-capture-sheet"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Capture
              </span>
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
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? Type freely \u2014 the system will tidy long brain dumps into a clean task."
              className="rounded-xl resize-none text-sm"
              rows={5}
              disabled={captureMutation.isPending}
              data-testid="universal-capture-text"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Popover open={whenPickerOpen} onOpenChange={setWhenPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
                    aria-label="Choose when"
                    data-testid="universal-capture-when"
                  >
                    <span className="text-muted-foreground">When:</span>
                    <span className="font-medium">{WHEN_LABEL[when]}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="w-40 p-1">
                  {(["today", "later"] as const).map((opt) => (
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

              <Popover open={areaPickerOpen} onOpenChange={setAreaPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted/40 transition-colors"
                    aria-label="Choose area"
                    data-testid="universal-capture-area"
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
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground" aria-live="polite">
                {confirmation ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden="true" /> {confirmation}
                  </span>
                ) : trimmed.length >= 60 ? (
                  "Long entries get a clean title from AI."
                ) : (
                  ""
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => submit(false)}
                  disabled={!canSave}
                  data-testid="universal-capture-save-another"
                  title="Save and add another (keeps area + when)"
                >
                  Save & add another
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => submit(true)}
                  disabled={!canSave}
                  data-testid="universal-capture-save"
                >
                  {captureMutation.isPending ? "Saving\u2026" : "Save"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
