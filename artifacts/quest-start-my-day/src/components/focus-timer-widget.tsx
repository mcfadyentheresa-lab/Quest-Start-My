import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, X, Volume2, VolumeX } from "lucide-react";

interface FocusTimerWidgetProps {
  isRunning: boolean;
  isVisible: boolean;
  remaining: number;
  totalSeconds: number;
  taskTitle: string | null;
  soundEnabled: boolean;
  audioUnlocked: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onToggleSound: () => void;
  onUnlockAudio: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimerWidget({
  isRunning,
  isVisible,
  remaining,
  totalSeconds,
  taskTitle,
  soundEnabled,
  audioUnlocked,
  onPause,
  onResume,
  onCancel,
  onToggleSound,
  onUnlockAudio,
}: FocusTimerWidgetProps) {
  const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
  const circumference = 2 * Math.PI * 10;
  const dashOffset = circumference * (1 - progress);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="focus-widget"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-violet-200 bg-violet-50/80 dark:border-violet-800 dark:bg-violet-900/10 px-4 py-3"
        >
          {soundEnabled && !audioUnlocked && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onClick={onUnlockAudio}
              className="w-full text-center text-xs text-violet-600 dark:text-violet-400 font-medium bg-violet-100 dark:bg-violet-900/30 rounded-xl px-3 py-2 mb-2 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
            >
              Tap to enable sound reminders
            </motion.button>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0 h-8 w-8">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 24 24" aria-hidden="true">
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  strokeWidth="2"
                  className="stroke-violet-200 dark:stroke-violet-800"
                />
                <circle
                  cx="12" cy="12" r="10"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="stroke-violet-600 dark:stroke-violet-400"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="sr-only">Timer progress</span>
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                Focus block
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xl font-mono font-semibold text-foreground tabular-nums"
                  aria-live="off"
                  aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
                >
                  {formatTime(remaining)}
                </span>
                {taskTitle && (
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={taskTitle}>
                    {taskTitle}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onToggleSound}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors text-muted-foreground"
                aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={isRunning ? onPause : onResume}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors text-violet-600 dark:text-violet-400"
                aria-label={isRunning ? "Pause timer" : "Resume timer"}
              >
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={onCancel}
                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors text-muted-foreground"
                aria-label="Cancel timer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
