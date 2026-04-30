import type { Task, Area } from "@workspace/db";
import type { BriefingInput, BriefingItem, BriefingResponse, BriefingPriority } from "./types";

const PRIORITY_RANK: Record<BriefingPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

function timeOfDayGreeting(hour: number, name: string): string {
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

function pillarPriorityFromValue(value: string | null | undefined): BriefingPriority {
  if (value === "P1" || value === "P2" || value === "P3" || value === "P4") return value;
  return "P3";
}

function shuffleSeed(date: string, hint: string | undefined): number {
  const key = `${date}|${hint ?? ""}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return h;
}

function rotate<T>(arr: T[], offset: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((offset % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

function pickItems(input: BriefingInput): BriefingItem[] {
  const { openTasks, pillars, activePillars, focusBlockMinutes } = input;
  const pillarMap = new Map<number, Area>();
  for (const p of pillars) pillarMap.set(p.id, p);

  const activeIds = new Set(activePillars.map((p) => p.id));

  function priorityForTask(t: Task): BriefingPriority {
    if (t.areaId !== null) {
      const pillar = pillarMap.get(t.areaId);
      if (pillar) return pillarPriorityFromValue(pillar.priority);
    }
    return "P3";
  }

  // Note: openTasks has already been filtered by service.ts to enforce the
  // step-by-step rule for ordered goals — later steps are hidden until
  // earlier ones close.
  const candidates = openTasks.filter((t) => t.status === "pending" || t.status === "blocked");

  const blockedSet = new Set(candidates.filter((t) => t.status === "blocked").map((t) => t.id));

  const reachable = candidates.filter((t) => {
    if (t.status !== "blocked") return true;
    return blockedSet.has(t.id);
  });

  const sorted = reachable.slice().sort((a, b) => {
    const pa = priorityForTask(a);
    const pb = priorityForTask(b);
    if (PRIORITY_RANK[pa] !== PRIORITY_RANK[pb]) return PRIORITY_RANK[pa] - PRIORITY_RANK[pb];
    const aActive = a.areaId !== null && activeIds.has(a.areaId) ? 0 : 1;
    const bActive = b.areaId !== null && activeIds.has(b.areaId) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (a.status === "blocked" && b.status !== "blocked") return 1;
    if (b.status === "blocked" && a.status !== "blocked") return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const offset = shuffleSeed(input.date, input.hint);
  const rotated = input.hint ? rotate(sorted, offset) : sorted;
  const picks = rotated.slice(0, 3);

  return picks.map((t) => {
    const pillar = t.areaId !== null ? pillarMap.get(t.areaId) : undefined;
    const priority = priorityForTask(t);
    const reasoning = buildReasoning(t, pillar ?? null, priority, activeIds.has(t.areaId ?? -1));
    return {
      taskId: t.id,
      title: t.title,
      pillarName: pillar?.name ?? "Unassigned",
      pillarColor: pillar?.color ?? null,
      priority,
      reasoning,
      estimatedMinutes: focusBlockMinutes,
      suggestedNextStep: t.suggestedNextStep ?? null,
      blockedBy: t.status === "blocked" ? t.blockerReason ?? "Blocked" : null,
    };
  });
}

function buildReasoning(
  task: Task,
  pillar: Area | null,
  priority: BriefingPriority,
  isActiveThisWeek: boolean,
): string {
  if (task.status === "blocked") {
    return `Surfaced because it's been blocked${task.blockerReason ? ` on "${task.blockerReason}"` : ""} — clearing this unsticks momentum.`;
  }
  if (priority === "P1" && isActiveThisWeek) {
    return `Surfaced because ${pillar ? pillar.name : "this pillar"} is your P1 focus this week.`;
  }
  if (isActiveThisWeek) {
    return `Surfaced because ${pillar ? pillar.name : "this pillar"} is on your active list this week.`;
  }
  if (task.suggestedNextStep) {
    return `Surfaced because the next concrete step is ready: "${task.suggestedNextStep}".`;
  }
  return `Surfaced as the next ${priority} action available.`;
}

function buildContext(input: BriefingInput, items: BriefingItem[]): string {
  const lastDone = input.recentlyCompleted[0];
  const p1 = input.activePillars.find((p) => p.priority === "P1") ?? input.activePillars[0];
  if (lastDone && p1) {
    return `You closed "${lastDone.title}" recently — carrying momentum into ${p1.name}, your ${p1.priority} this week.`;
  }
  if (p1 && items.length > 0) {
    return `${p1.name} is your ${p1.priority} this week — today's plan keeps it moving.`;
  }
  if (items.length === 0) {
    return `No open tasks today — a clear runway to set the next intention.`;
  }
  return `Here's what your assistant put on the radar for today.`;
}

function buildHeadline(items: BriefingItem[]): string {
  if (items.length === 0) return "A quiet day on the plan.";
  if (items.length === 1) return "One thing matters today.";
  if (items.length === 2) return "Two things matter today.";
  return "Three things matter today.";
}

function buildSignoff(items: BriefingItem[]): string {
  if (items.length === 0) return "I've got the rest of the week on the radar — pick a pillar to start something fresh.";
  return "I've got the rest of the week on the radar. Tap any item to start.";
}

export function buildRulesBriefing(input: BriefingInput): BriefingResponse {
  const items = pickItems(input);
  return {
    greeting: timeOfDayGreeting(input.hourLocal, input.userFirstName),
    headline: buildHeadline(items),
    context: buildContext(input, items),
    briefing: items,
    signoff: buildSignoff(items),
    date: input.date,
    source: "rules",
    approved: false,
    generatedAt: input.now.toISOString(),
  };
}
