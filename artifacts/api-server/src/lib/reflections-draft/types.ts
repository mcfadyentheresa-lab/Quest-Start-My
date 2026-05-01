import type { Area, Task, ProgressLog, Milestone } from "@workspace/db";

export type ReflectionCadence = "week" | "month";

export type ReflectionDraftSource = "ai" | "rules" | "fallback";

export type ReflectionDraft = {
  moved: string;
  stuck: string;
  drop: string;
  nextFocus: string;
  source: ReflectionDraftSource;
  generatedAt: string;
};

export type ReflectionDraftInput = {
  cadence: ReflectionCadence;
  // Period start (YYYY-MM-DD for weeks, YYYY-MM-01 for months).
  periodStart: string;
  // Period end (YYYY-MM-DD inclusive for weeks; last day of month for months).
  periodEnd: string;
  // Human-readable period label, e.g. "this week" or "April 2026".
  periodLabel: string;
  now: Date;
  areas: Area[];
  activeAreas: Area[];
  completedTasks: Task[];
  openTasks: Task[];
  recentLogs: ProgressLog[];
  milestones: Milestone[];
};
