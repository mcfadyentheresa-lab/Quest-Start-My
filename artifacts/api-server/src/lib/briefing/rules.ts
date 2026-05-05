import type { Task, Area, Milestone } from "@workspace/db";
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
  const { openTasks, pillars, activePillars, focusBlockMinutes, milestones, recentlyCompleted, now } = input;
  const pillarMap = new Map<number, Area>();
  for (const p of pillars) pillarMap.set(p.id, p);

  const milestoneMap = new Map<number, Milestone>();
  for (const m of milestones) milestoneMap.set(m.id, m);

  // Phase deps: build a map from prerequisite milestone id -> list of
  // milestones that are waiting on it. Used to add a "Phase 2 holds until
  // Phase 1 wraps" line when the surfaced task closes a gating milestone.
  const dependentsByPrereq = new Map<number, Milestone[]>();
  for (const m of milestones) {
    if (m.holdUntilMilestoneId == null) continue;
    const list = dependentsByPrereq.get(m.holdUntilMilestoneId) ?? [];
    list.push(m);
    dependentsByPrereq.set(m.holdUntilMilestoneId, list);
  }

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
    const milestone = t.milestoneId !== null ? milestoneMap.get(t.milestoneId) ?? null : null;
    const dependents = milestone ? dependentsByPrereq.get(milestone.id) ?? [] : [];
    const reasoning = buildReasoning(
      t,
      pillar ?? null,
      priority,
      activeIds.has(t.areaId ?? -1),
      milestone,
      openTasks,
      recentlyCompleted,
      now,
      dependents,
    );
    return {
      taskId: t.id,
      title: t.title,
      pillarName: pillar?.name ?? "Unassigned",
      pillarColor: pillar?.color ?? null,
      goalId: null,
      goalTitle: null,
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
  milestone: Milestone | null,
  allOpenTasks: Task[],
  recentlyCompleted: Task[],
  now: Date,
  dependents: Milestone[] = [],
): string {
  // Phase deps: when this task lives on a milestone that another goal is
  // holding for, drop a one-line "next phase holds until this one wraps"
  // hint that's appendable to the main reasoning.
  const heldFollowUp = (() => {
    if (!milestone || dependents.length === 0) return "";
    const next = dependents[0]!;
    return ` "${next.title}" holds until "${milestone.title}" wraps.`;
  })();

  if (task.status === "blocked") {
    return `Surfaced because it's been blocked${task.blockerReason ? ` on "${task.blockerReason}"` : ""} — clearing this unsticks momentum.${heldFollowUp}`;
  }

  // Ordered-step progress: this task is the lowest-sortOrder open step on
  // an ordered milestone — surface "step n of m" so the user sees the gate.
  if (
    milestone &&
    milestone.mode === "ordered" &&
    task.milestoneId !== null
  ) {
    const openForMilestone = allOpenTasks
      .filter((t) => t.milestoneId === task.milestoneId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const lowest = openForMilestone[0];
    if (lowest && lowest.id === task.id) {
      const closedForMilestone = recentlyCompleted.filter((t) => t.milestoneId === task.milestoneId).length;
      const total = openForMilestone.length + closedForMilestone;
      if (total > 1) {
        const stepNumber = closedForMilestone + 1;
        return `Step ${stepNumber} of ${total} on goal "${milestone.title}". Earlier steps are done; later ones stay hidden until this one closes.${heldFollowUp}`;
      }
    }
  }

  // Stale active-area: pillar is active this week but hasn't been touched
  // in ≥5 days — nudge a short push.
  if (isActiveThisWeek && pillar && pillar.lastUpdated) {
    const last = new Date(pillar.lastUpdated);
    if (!isNaN(last.getTime())) {
      const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 5) {
        return `Marked active this week. No progress logged in ${days} days — worth a 25-minute push.`;
      }
    }
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
