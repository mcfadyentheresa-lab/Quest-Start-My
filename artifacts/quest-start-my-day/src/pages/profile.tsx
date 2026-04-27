import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useUser, SignOutButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/clerk-config";
import { User, LogOut, Volume2, VolumeX } from "lucide-react";

const FOCUS_DURATION_OPTIONS = [5, 10, 15, 25] as const;

function readLocalBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function readLocalInt(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  } catch {
    return fallback;
  }
}

function ClerkUserBlock() {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? "—";
  const name = user.fullName ?? user.firstName ?? "—";
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Name</p>
        <p className="text-sm text-foreground">{name}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Email</p>
        <p className="text-sm text-foreground">{email}</p>
      </div>
      <SignOutButton>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 mt-2">
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </SignOutButton>
    </div>
  );
}

function OwnerUserBlock() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Name</p>
        <p className="text-sm text-foreground">Theresa McFadyen</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Email</p>
        <p className="text-sm text-foreground">info@asterandspruceliving.ca</p>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Running in single-owner mode. Connect Clerk to enable accounts.
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const [soundEnabled, setSoundEnabledState] = useState(() => readLocalBool("quest_sound_enabled", true));
  const [defaultDuration, setDefaultDurationState] = useState(() => readLocalInt("quest_timer_duration_minutes", 25));

  const toggleSound = useCallback(() => {
    setSoundEnabledState(prev => {
      const next = !prev;
      try {
        localStorage.setItem("quest_sound_enabled", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setDuration = useCallback((d: number) => {
    setDefaultDurationState(d);
    try {
      localStorage.setItem("quest_timer_duration_minutes", String(d));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your account and preferences</p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-card-border p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Account</p>
        </div>
        {isClerkEnabled() ? <ClerkUserBlock /> : <OwnerUserBlock />}
      </motion.section>

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
          <div className="flex gap-2 flex-wrap">
            {FOCUS_DURATION_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`text-sm px-4 py-1.5 rounded-full border transition-colors font-medium ${
                  defaultDuration === d
                    ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-900/40 dark:border-violet-500 dark:text-violet-300"
                    : "border-border text-muted-foreground hover:border-violet-300 hover:text-violet-600"
                }`}
                aria-pressed={defaultDuration === d}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <p className="text-xs text-muted-foreground">
            {soundEnabled
              ? `Sound on · ${defaultDuration}-min default · Browser must allow audio after first interaction`
              : `Sound off · ${defaultDuration}-min default · Visual reminder only`}
          </p>
        </div>
      </motion.section>
    </div>
  );
}
