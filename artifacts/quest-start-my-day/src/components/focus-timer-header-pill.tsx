import { motion, AnimatePresence } from "framer-motion";
import { Timer, X } from "lucide-react";
import { useFocusTimer } from "@/hooks/use-focus-timer";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusTimerHeaderPill() {
  const timer = useFocusTimer();
  const visible = timer.isRunning || (timer.remaining > 0 && !timer.isNudging);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="focus-pill"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20 pl-2 pr-1 py-0.5"
          role="status"
          aria-live="off"
          aria-label={`Focus block running, ${Math.floor(timer.remaining / 60)} minutes ${timer.remaining % 60} seconds remaining`}
          data-testid="focus-header-pill"
        >
          <Timer className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0" aria-hidden="true" />
          <span className="font-mono text-xs font-semibold tabular-nums text-violet-700 dark:text-violet-300">
            {formatTime(timer.remaining)}
          </span>
          <button
            type="button"
            onClick={timer.cancelTimer}
            className="h-5 w-5 flex items-center justify-center rounded-full text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
            aria-label="Cancel focus block"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
