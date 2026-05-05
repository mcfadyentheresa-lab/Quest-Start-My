import type { Area, Task, WeeklyPlan, ProgressLog, Milestone } from "@workspace/db";

export type BriefingPriority = "P1" | "P2" | "P3" | "P4";

export type BriefingItem = {
  taskId: string | number | null;
  title: string;
  pillarName: string;
  pillarColor: string | null;
  goalId: number | null;
  goalTitle: string | null;
  priority: BriefingPriority;
  reasoning: string;
  estimatedMinutes: number;
  suggestedNextStep: string | null;
  blockedBy: string | null;
};

export type BriefingResponse = {
  greeting: string;
  headline: string;
  context: string;
  briefing: BriefingItem[];
  signoff: string;
  date: string;
  source: "ai" | "rules" | "fallback";
  approved: boolean;
  generatedAt: string;
};

export type BriefingInput = {
  date: string;
  now: Date;
  hourLocal: number;
  userFirstName: string;
  pillars: Area[];
  activePillars: Area[];
  weeklyPlan: WeeklyPlan | null;
  openTasks: Task[];
  recentlyCompleted: Task[];
  recentLogs: ProgressLog[];
  // Phase 3: full milestone ("goal") list. Used to enforce the
  // step-by-step rule — for goals with mode="ordered", only the
  // lowest-sortOrder pending sub-task is eligible for the briefing.
  milestones: Milestone[];
  focusBlockMinutes: number;
  hint?: string;
};
