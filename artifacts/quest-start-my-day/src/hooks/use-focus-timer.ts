import { useState, useEffect, useRef, useCallback } from "react";

const LS_SOUND = "quest_sound_enabled";
const LS_DURATION = "quest_timer_duration_minutes";

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

function playChime(soundEnabled: boolean) {
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
  setSoundEnabled: (v: boolean) => void;
  setDefaultDuration: (mins: number) => void;
  unlockAudio: () => Promise<void>;
  startTimer: (opts: { taskTitle: string; taskId: number; durationMins?: number }) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  cancelTimer: () => void;
  snooze: (mins: number) => void;
  needMoreTime: (extraMins?: number) => void;
  dismissNudge: () => void;
}

export function useFocusTimer(): FocusTimerState {
  const [isRunning, setIsRunning] = useState(false);
  const [isNudging, setIsNudging] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(() => readBool(LS_SOUND, true));
  const [audioUnlocked, setAudioUnlocked] = useState(isAudioContextRunning);
  const [defaultDuration, setDefaultDurationState] = useState(() => readInt(LS_DURATION, 25));

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

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
    setDefaultDurationState(mins);
    try { localStorage.setItem(LS_DURATION, String(mins)); } catch { }
  }, []);

  const unlockAudio = useCallback(async () => {
    const ok = await unlockAudioContext();
    setAudioUnlocked(ok);
  }, []);

  const startTimer = useCallback((opts: { taskTitle: string; taskId: number; durationMins?: number }) => {
    clearInterval_();
    const secs = (opts.durationMins ?? defaultDuration) * 60;
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
    setRemaining(mins * 60);
    setTotalSeconds(mins * 60);
    setIsRunning(true);
  }, [clearInterval_]);

  const needMoreTime = useCallback((extraMins = 15) => {
    clearInterval_();
    setIsNudging(false);
    setRemaining(extraMins * 60);
    setTotalSeconds(extraMins * 60);
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
        if (prev <= 1) {
          clearInterval_();
          setIsRunning(false);
          setIsNudging(true);
          playChime(soundEnabledRef.current);
          return 0;
        }
        return prev - 1;
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
    setSoundEnabled,
    setDefaultDuration,
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
