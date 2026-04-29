import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo, createElement, type ReactNode } from "react";

const LS_SOUND = "quest_sound_enabled";
const LS_DURATION = "quest_timer_duration_minutes";
const LS_NOTIFY = "quest_notifications_enabled";

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 180;

export function clampDuration(mins: number): number {
  if (!Number.isFinite(mins)) return 25;
  const rounded = Math.round(mins);
  if (rounded < MIN_DURATION_MINUTES) return MIN_DURATION_MINUTES;
  if (rounded > MAX_DURATION_MINUTES) return MAX_DURATION_MINUTES;
  return rounded;
}

export interface TickResult {
  remaining: number;
  finished: boolean;
}

export function tickDown(remaining: number): TickResult {
  if (remaining <= 1) return { remaining: 0, finished: true };
  return { remaining: remaining - 1, finished: false };
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "true";
  } catch { return fallback; }
}

function readInt(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : n;
  } catch { return fallback; }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audioCtx;
  } catch { return null; }
}

export function playChime(soundEnabled: boolean) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") return;

  const notes = [528, 660, 792];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + i * 0.32;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
    osc.start(start);
    osc.stop(start + 0.9);
  });
}

export function unlockAudioContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === "running") return Promise.resolve(true);
  return ctx.resume().then(() => ctx.state === "running").catch(() => false);
}

export function isAudioContextRunning(): boolean {
  const ctx = getAudioContext();
  return ctx !== null && ctx.state === "running";
}

export type NotificationPermissionStatus = "granted" | "denied" | "default" | "unsupported";

function readNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

export function fireCompletionNotification(taskTitle: string | null, enabled: boolean): boolean {
  if (!enabled) return false;
  if (typeof window === "undefined" || typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  try {
    const body = taskTitle ? `${taskTitle} — focus block complete` : "Focus block complete";
    new Notification("Quest · Focus block complete", { body, tag: "quest-focus-timer" });
    return true;
  } catch {
    return false;
  }
}

export interface FocusTimerState {
  isRunning: boolean;
  isNudging: boolean;
  remaining: number;
  totalSeconds: number;
  taskTitle: string | null;
  taskId: number | null;
  soundEnabled: boolean;
  audioUnlocked: boolean;
  defaultDuration: number;
  notificationsEnabled: boolean;
  notificationPermission: NotificationPermissionStatus;
  setSoundEnabled: (v: boolean) => void;
  setDefaultDuration: (mins: number) => void;
  setNotificationsEnabled: (v: boolean) => Promise<NotificationPermissionStatus>;
  unlockAudio: () => Promise<void>;
  startTimer: (opts: { taskTitle: string; taskId: number; durationMins?: number }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  cancelTimer: () => void;
  snooze: (mins: number) => void;
  needMoreTime: (extraMins?: number) => void;
  dismissNudge: () => void;
}

function useFocusTimerState(): FocusTimerState {
  const [isRunning, setIsRunning] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(() => readBool(LS_SOUND, true));
  const [audioUnlocked, setAudioUnlocked] = useState(isAudioContextRunning);
  const [defaultDuration, setDefaultDurationState] = useState(() => clampDuration(readInt(LS_DURATION, 25)));
  const [notificationsEnabled, setNotificationsEnabledState] = useState(() => readBool(LS_NOTIFY, false));
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>(() => readNotificationPermission());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const notificationsEnabledRef = useRef(notificationsEnabled);
  notificationsEnabledRef.current = notificationsEnabled;
  const taskTitleRef = useRef(taskTitle);
  taskTitleRef.current = taskTitle;

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    try { localStorage.setItem(LS_SOUND, String(v)); } catch { }
  }, []);

  const setDefaultDuration = useCallback((mins: number) => {
    const safe = clampDuration(mins);
    setDefaultDurationState(safe);
    try { localStorage.setItem(LS_DURATION, String(safe)); } catch { }
  }, []);

  const setNotificationsEnabled = useCallback(async (v: boolean): Promise<NotificationPermissionStatus> => {
    if (!v) {
      setNotificationsEnabledState(false);
      try { localStorage.setItem(LS_NOTIFY, "false"); } catch { }
      return readNotificationPermission();
    }
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
    const accepted = result === "granted";
    setNotificationsEnabledState(accepted);
    try { localStorage.setItem(LS_NOTIFY, String(accepted)); } catch { }
    return result;
  }, []);

  const unlockAudio = useCallback(async () => {
    const ok = await unlockAudioContext();
    setAudioUnlocked(ok);
  }, []);

  const startTimer = useCallback((opts: { taskTitle: string; taskId: number; durationMins?: number }) => {
    clearInterval_();
    const mins = clampDuration(opts.durationMins ?? defaultDuration);
    const secs = mins * 60;
    setTaskTitle(opts.taskTitle);
    setTaskId(opts.taskId);
    setRemaining(secs);
    setTotalSeconds(secs);
    setIsNudging(false);
    setIsRunning(true);
  }, [clearInterval_, defaultDuration]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    clearInterval_();
  }, [clearInterval_]);

  const resumeTimer = useCallback(() => {
    setIsRunning(true);
  }, []);

  const cancelTimer = useCallback(() => {
    clearInterval_();
    setIsRunning(false);
    setIsNudging(false);
    setRemaining(0);
    setTotalSeconds(0);
    setTaskTitle(null);
    setTaskId(null);
  }, [clearInterval_]);

  const snooze = useCallback((mins: number) => {
    clearInterval_();
    setIsNudging(false);
    const secs = clampDuration(mins) * 60;
    setRemaining(secs);
    setTotalSeconds(secs);
    setIsRunning(true);
  }, [clearInterval_]);

  const needMoreTime = useCallback((extraMins = 15) => {
    clearInterval_();
    setIsNudging(false);
    const secs = clampDuration(extraMins) * 60;
    setRemaining(secs);
    setTotalSeconds(secs);
    setIsRunning(true);
  }, [clearInterval_]);

  const dismissNudge = useCallback(() => {
    setIsNudging(false);
    cancelTimer();
  }, [cancelTimer]);

  useEffect(() => {
    if (!isRunning) {
      clearInterval_();
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = tickDown(prev);
        if (next.finished) {
          clearInterval_();
          setIsRunning(false);
          setIsNudging(true);
          playChime(soundEnabledRef.current);
          fireCompletionNotification(taskTitleRef.current, notificationsEnabledRef.current);
        }
        return next.remaining;
      });
    }, 1000);
    return clearInterval_;
  }, [isRunning, clearInterval_]);

  return {
    isRunning,
    isNudging,
    remaining,
    totalSeconds,
    taskTitle,
    taskId,
    soundEnabled,
    audioUnlocked,
    defaultDuration,
    notificationsEnabled,
    notificationPermission,
    setSoundEnabled,
    setDefaultDuration,
    setNotificationsEnabled,
    unlockAudio,
    startTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    snooze,
    needMoreTime,
    dismissNudge,
  };
}

const FocusTimerContext = createContext<FocusTimerState | null>(null);

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const value = useFocusTimerState();
  const memo = useMemo(() => value, [value]);
  return createElement(FocusTimerContext.Provider, { value: memo }, children);
}

export function useFocusTimer(): FocusTimerState {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) {
    throw new Error("useFocusTimer must be used within a FocusTimerProvider");
  }
  return ctx;
}
