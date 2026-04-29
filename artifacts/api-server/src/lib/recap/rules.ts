import type { Area, Task } from "@workspace/db";
import type {
  RecapAreaBreakdown,
  RecapInput,
  RecapResponse,
  RecapTaskRef,
} from "./types";

export const REFLECTION_PROMPTS = [
  "What surprised you today?",
  "Where did momentum show up?",
  "What's worth carrying into tomorrow?",
  "What deserved more attention than it got?",
  "What can you let go of before tomorrow?",
] as const;

export function pickReflectionPrompt(index: number): string {
  const safe = ((index % REFLECTION_PROMPTS.length) + REFLECTION_PROMPTS.length) %
    REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[safe] ?? REFLECTION_PROMPTS[0];
}

function toTaskRef(task: Task, pillarMap: Map<number, Area>): RecapTaskRef {
  const pillar = task.areaId !== null ? pillarMap.get(task.areaId) : undefined;
  return {
    taskId: task.id,
    title: task.title,
    pillarName: pillar?.name ?? "Unassigned",
    pillarColor: pillar?.color ?? null,
  };
}

export function computeAreaBreakdown(
  closedToday: Task[],
  pillars: Area[],
): RecapAreaBreakdown[] {
  const pillarMap = new Map(pillars.map((p) => [p.id, p]));
  const counts = new Map<number | null, number>();
  for (const t of closedToday) {
    const key = t.areaId !== null && pillarMap.has(t.areaId) ? t.areaId : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: RecapAreaBreakdown[] = [];
  for (const [areaId, closedCount] of counts) {
    if (areaId === null) {
      out.push({ areaId: null, pillarName: "Unassigned", pillarColor: null, closedCount });
    } else {
      const p = pillarMap.get(areaId);
      if (p) {
        out.push({
          areaId: p.id,
          pillarName: p.name,
          pillarColor: p.color ?? null,
          closedCount,
        });
      }
    }
  }
  return out.sort((a, b) => b.closedCount - a.closedCount);
}

function greeting(name: string): string {
  return `Evening, ${name}.`;
}

function headline(closed: number, rolled: number): string {
  const total = closed + rolled;
  if (total === 0) return "A quiet day on the plan.";
  if (rolled === 0) return `Solid day — closed ${closed} of ${closed}.`;
  if (closed === 0) return `Rolled ${rolled} into tomorrow — fresh start ahead.`;
  return `Solid day — closed ${closed} of ${total}.`;
}

function buildAreaSentence(breakdown: RecapAreaBreakdown[]): string {
  if (breakdown.length === 0) return "Nothing closed today — tomorrow's a clean slate.";
  const top = breakdown[0]!;
  if (breakdown.length === 1) {
    return `All of today lived in ${top.pillarName}.`;
  }
  const total = breakdown.reduce((sum, b) => sum + b.closedCount, 0);
  if (top.closedCount / total >= 0.6) {
    return `Most of today lived in ${top.pillarName}.`;
  }
  const second = breakdown[1]!;
  return `Time split between ${top.pillarName} and ${second.pillarName}.`;
}

function signoff(closed: number, rolled: number): string {
  if (closed + rolled === 0) return "Rest up. Tomorrow is wide open.";
  if (rolled === 0) return "Rest up. Tomorrow's plan is staged.";
  return "Rest up. Tomorrow's plan is staged.";
}

export function buildRulesRecap(input: RecapInput): RecapResponse {
  const pillarMap = new Map(input.pillars.map((p) => [p.id, p]));
  const closedToday = input.closedToday.map((t) => toTaskRef(t, pillarMap));
  const rolledToTomorrow = input.openToday.map((t) => toTaskRef(t, pillarMap));
  const breakdown = computeAreaBreakdown(input.closedToday, input.pillars);

  return {
    greeting: greeting(input.userFirstName),
    headline: headline(closedToday.length, rolledToTomorrow.length),
    closedToday,
    rolledToTomorrow,
    areaBreakdown: buildAreaSentence(breakdown),
    reflectionPrompt: pickReflectionPrompt(input.reflectionPromptIndex),
    reflection: null,
    signoff: signoff(closedToday.length, rolledToTomorrow.length),
    date: input.date,
    source: "rules",
    generatedAt: input.now.toISOString(),
  };
}
