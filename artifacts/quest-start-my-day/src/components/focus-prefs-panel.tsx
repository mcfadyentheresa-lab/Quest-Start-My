import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useFocusTimer,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  clampDuration,
} from "@/hooks/use-focus-timer";

const FOCUS_DURATION_OPTIONS = [5, 10, 15, 25] as const;

export function FocusPrefsPanel() {
  const { toast } = useToast();
  const focus = useFocusTimer();
  const soundEnabled = focus.soundEnabled;
  const defaultDuration = focus.defaultDuration;
  const isPresetDuration = (FOCUS_DURATION_OPTIONS as readonly number[]).includes(defaultDuration);
  const [customDurationInput, setCustomDurationInput] = useState<string>(
    isPresetDuration ? "" : String(defaultDuration),
  );

  const toggleSound = useCallback(() => {
    focus.setSoundEnabled(!focus.soundEnabled);
  }, [focus]);

  const setDuration = useCallback((d: number) => {
    focus.setDefaultDuration(d);
    setCustomDurationInput("");
  }, [focus]);

  const handleCustomDurationChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setCustomDurationInput(cleaned);
    if (cleaned === "") return;
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed >= MIN_DURATION_MINUTES && parsed <= MAX_DURATION_MINUTES) {
      focus.setDefaultDuration(parsed);
    }
  };

  const handleCustomDurationCommit = () => {
    if (customDurationInput === "") return;
    const parsed = parseInt(customDurationInput, 10);
    if (isNaN(parsed)) { setCustomDurationInput(""); return; }
    const safe = clampDuration(parsed);
    focus.setDefaultDuration(safe);
    setCustomDurationInput(String(safe));
  };

  const handleToggleNotifications = useCallback(async () => {
    if (focus.notificationsEnabled) {
      await focus.setNotificationsEnabled(false);
      return;
    }
    const result = await focus.setNotificationsEnabled(true);
    if (result === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Your browser is blocking notifications for this site. Update site permissions to enable them.",
        variant: "destructive",
      });
    } else if (result === "unsupported") {
      toast({
        title: "Not supported",
        description: "This browser does not support desktop notifications.",
      });
    }
  }, [focus, toast]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-card-border p-5 space-y-4"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Focus reminders</p>
        <p className="text-xs text-muted-foreground">Optional timed focus blocks with a gentle nudge when time is up.</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Sound reminders</p>
          <p className="text-xs text-muted-foreground">Play a soft chime when your focus block ends</p>
        </div>
        <button
          onClick={toggleSound}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            soundEnabled ? "bg-violet-600" : "bg-muted"
          }`}
          role="switch"
          aria-checked={soundEnabled}
          aria-label="Toggle sound reminders"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              soundEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2">Default focus duration</p>
        <div className="flex gap-2 flex-wrap items-center">
          {FOCUS_DURATION_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`text-sm px-4 py-1.5 rounded-full border transition-colors font-medium ${
                defaultDuration === d && customDurationInput === ""
                  ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300"
                  : "border-border text-muted-foreground hover:border-violet-300 hover:text-violet-600"
              }`}
              aria-pressed={defaultDuration === d && customDurationInput === ""}
            >
              {d} min
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            step={1}
            value={customDurationInput}
            onChange={e => handleCustomDurationChange(e.target.value)}
            onBlur={handleCustomDurationCommit}
            onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            placeholder={isPresetDuration ? "custom" : `${defaultDuration}m`}
            aria-label="Custom default duration in minutes (1 to 180)"
            className={`w-24 text-sm px-3 py-1.5 rounded-full border bg-transparent text-center font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              !isPresetDuration && customDurationInput !== ""
                ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300"
                : "border-border text-muted-foreground"
            }`}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Type any value from {MIN_DURATION_MINUTES} to {MAX_DURATION_MINUTES} minutes.</p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">Desktop notifications</p>
          <p className="text-xs text-muted-foreground">
            {focus.notificationPermission === "denied"
              ? "Blocked by your browser — update site permissions to enable"
              : focus.notificationPermission === "unsupported"
                ? "This browser does not support notifications"
                : "Get notified when your focus block ends, even if the tab isn't focused"}
          </p>
        </div>
        <button
          onClick={handleToggleNotifications}
          disabled={focus.notificationPermission === "denied" || focus.notificationPermission === "unsupported"}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            focus.notificationsEnabled ? "bg-violet-600" : "bg-muted"
          }`}
          role="switch"
          aria-checked={focus.notificationsEnabled}
          aria-label="Toggle desktop notifications"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              focus.notificationsEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        <span className="flex items-center gap-1.5">
          {soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {soundEnabled
              ? `Sound on · ${defaultDuration}-min default · Browser must allow audio after first interaction`
              : `Sound off · ${defaultDuration}-min default · Visual reminder only`}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          {focus.notificationsEnabled ? (
            <Bell className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          ) : (
            <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {focus.notificationsEnabled ? "Desktop notifications on" : "Desktop notifications off"}
          </span>
        </span>
      </div>
    </motion.section>
  );
}
