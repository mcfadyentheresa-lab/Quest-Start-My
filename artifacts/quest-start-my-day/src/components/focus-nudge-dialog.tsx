import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FocusNudgeDialogProps {
  open: boolean;
  taskTitle: string | null;
  nextTaskTitle?: string | null;
  soundEnabled: boolean;
  onStartNext: () => void;
  onSnooze5: () => void;
  onSnooze15: () => void;
  onNeedMoreTime: () => void;
  onDismiss: () => void;
  onToggleSound: () => void;
}

export function FocusNudgeDialog({
  open,
  taskTitle,
  nextTaskTitle,
  soundEnabled,
  onStartNext,
  onSnooze5,
  onSnooze15,
  onNeedMoreTime,
  onDismiss,
  onToggleSound,
}: FocusNudgeDialogProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => firstButtonRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="nudge-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onDismiss}
            aria-hidden="true"
          />
          <motion.div
            key="nudge-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Focus block complete"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,360px)]"
          >
            <div className="rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
              <div className="px-5 pt-5 pb-2">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Focus block complete</p>
                      <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
                        Time to switch tasks?
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {taskTitle && (
                  <div className="rounded-xl bg-muted/50 px-3 py-2 mb-3">
                    <p className="text-xs text-muted-foreground">Current task</p>
                    <p className="text-sm font-medium text-foreground truncate">{taskTitle}</p>
                  </div>
                )}

                {nextTaskTitle && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 px-3 py-2 mb-3">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Up next</p>
                    <p className="text-sm font-medium text-foreground truncate">{nextTaskTitle}</p>
                  </div>
                )}
              </div>

              <div className="px-5 pb-2 space-y-2">
                <Button
                  ref={firstButtonRef}
                  className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                  onClick={onStartNext}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {nextTaskTitle ? "Start next task" : "Done — close timer"}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl font-medium text-sm"
                    onClick={onSnooze5}
                    aria-label="Snooze 5 minutes"
                  >
                    Snooze 5 min
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl font-medium text-sm"
                    onClick={onSnooze15}
                    aria-label="Snooze 15 minutes"
                  >
                    Snooze 15 min
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full rounded-xl font-medium text-sm text-muted-foreground"
                  onClick={onNeedMoreTime}
                  aria-label="Need more time — extend by 15 minutes"
                >
                  <SkipForward className="h-3.5 w-3.5 mr-1.5 rotate-180" />
                  Need more time (+15 min)
                </Button>
              </div>

              <div className="px-5 pb-4 pt-1 flex items-center justify-end">
                <button
                  onClick={onToggleSound}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={soundEnabled ? "Mute sound reminders" : "Unmute sound reminders"}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  {soundEnabled ? "Sound on" : "Sound off"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
