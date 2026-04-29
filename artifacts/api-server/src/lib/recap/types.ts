import type { Area, Task } from "@workspace/db";

export type RecapTaskRef = {
  taskId: number | null;
  title: string;
  pillarName: string;
  pillarColor: string | null;
};

export type RecapAreaBreakdown = {
  areaId: number | null;
  pillarName: string;
  pillarColor: string | null;
  closedCount: number;
};

export type RecapResponse = {
  greeting: string;
  headline: string;
  closedToday: RecapTaskRef[];
  rolledToTomorrow: RecapTaskRef[];
  areaBreakdown: string;
  reflectionPrompt: string;
  reflection: string | null;
  signoff: string;
  date: string;
  source: "ai" | "rules" | "fallback";
  generatedAt: string;
};

export type RecapInput = {
  date: string;
  now: Date;
  hourLocal: number;
  userFirstName: string;
  pillars: Area[];
  closedToday: Task[];
  openToday: Task[];
  reflectionPromptIndex: number;
};
