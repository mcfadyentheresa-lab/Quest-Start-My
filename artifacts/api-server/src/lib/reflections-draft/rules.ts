import type { Area, Task } from "@workspace/db";
import type { ReflectionDraft, ReflectionDraftInput } from "./types";

const STUCK_DAYS = 5;

function pickAreaName(task: Task, areaMap: Map<number, Area>): string {
  if (task.areaId == null) return "Unassigned";
  return areaMap.get(task.areaId)?.name ?? "Unassigned";
}

function groupCompletedByArea(
  tasks: Task[],
  areaMap: Map<number, Area>,
): { name: string; count: number; titles: string[] }[] {
  const buckets = new Map<string, { name: string; count: number; titles: string[] }>();
  for (const t of tasks) {
    const name = pickAreaName(t, areaMap);
    const cur = buckets.get(name) ?? { name, count: 0, titles: [] };
    cur.count += 1;
    if (cur.titles.length < 3) cur.titles.push(t.title);
    buckets.set(name, cur);
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}

function daysSince(dateStr: string, now: Date): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function buildMoved(input: ReflectionDraftInput, areaMap: Map<number, Area>): string {
  const grouped = groupCompletedByArea(input.completedTasks, areaMap);
  if (grouped.length === 0) {
    return `No tasks closed ${input.periodLabel}. A clean slate to set the next move.`;
  }
  const lines = grouped.slice(0, 4).map((g) => {
    const sample = g.titles[0] ? ` (e.g. "${g.titles[0]}")` : "";
    return `- ${g.name}: ${g.count} ${g.count === 1 ? "task" : "tasks"} closed${sample}.`;
  });
  return lines.join("\n");
}

function buildStuck(input: ReflectionDraftInput, areaMap: Map<number, Area>): string {
  const lines: string[] = [];

  const blocked = input.openTasks.filter((t) => t.status === "blocked");
  if (blocked.length > 0) {
    const sample = blocked.slice(0, 3).map((t) => `"${t.title}"`).join(", ");
    lines.push(`- Blocked: ${sample}${blocked.length > 3 ? ` (+${blocked.length - 3} more)` : ""}.`);
  }

  const stale = input.openTasks
    .filter((t) => t.status === "pending" && daysSince(t.date, input.now) >= STUCK_DAYS)
    .sort((a, b) => daysSince(b.date, input.now) - daysSince(a.date, input.now));
  if (stale.length > 0) {
    const sample = stale.slice(0, 3).map((t) => `"${t.title}" (${daysSince(t.date, input.now)}d)`).join(", ");
    lines.push(`- Sitting too long: ${sample}.`);
  }

  const completedAreaIds = new Set(
    input.completedTasks.map((t) => t.areaId).filter((id): id is number => id !== null),
  );
  const silentActive = input.activeAreas.filter((a) => !completedAreaIds.has(a.id));
  if (silentActive.length > 0) {
    const names = silentActive.slice(0, 3).map((a) => a.name).join(", ");
    lines.push(`- Active but quiet: ${names}.`);
  }

  if (lines.length === 0) {
    return `Nothing flagged as stuck ${input.periodLabel}. Momentum looks clean.`;
  }
  return lines.join("\n");
}

function buildDrop(input: ReflectionDraftInput, areaMap: Map<number, Area>): string {
  void areaMap;
  const lines: string[] = [];

  const completedAreaIds = new Set(
    input.completedTasks.map((t) => t.areaId).filter((id): id is number => id !== null),
  );
  const activeNoMoves = input.activeAreas.filter((a) => !completedAreaIds.has(a.id));
  if (activeNoMoves.length > 0) {
    const names = activeNoMoves.slice(0, 3).map((a) => a.name).join(", ");
    lines.push(`- Marked active with no moves: ${names}. Consider deactivating or shrinking the ask.`);
  }

  const parkedWithOpen = input.areas.filter((a) => {
    if (a.portfolioStatus !== "Parked") return false;
    return input.openTasks.some((t) => t.areaId === a.id && t.status !== "done");
  });
  if (parkedWithOpen.length > 0) {
    const names = parkedWithOpen.slice(0, 3).map((a) => a.name).join(", ");
    lines.push(`- Parked but still open: ${names}. Either un-park or close out the leftovers.`);
  }

  if (lines.length === 0) {
    return `Nothing obvious to drop. Keep the current shape.`;
  }
  return lines.join("\n");
}

function buildNextFocus(input: ReflectionDraftInput, areaMap: Map<number, Area>): string {
  const p1Active =
    input.activeAreas.find((a) => a.priority === "P1") ?? input.activeAreas[0];
  if (!p1Active) {
    return `Pick one area to make active next ${input.cadence === "week" ? "week" : "month"} and the plan will draft from it.`;
  }

  const milestonesForArea = input.milestones
    .filter((m) => m.areaId === p1Active.id && m.status !== "complete")
    .sort((a, b) => {
      const pa = a.priority ?? "P3";
      const pb = b.priority ?? "P3";
      if (pa !== pb) return pa.localeCompare(pb);
      return a.sortOrder - b.sortOrder;
    });
  const topMilestone = milestonesForArea[0] ?? null;

  const openOnArea = input.openTasks
    .filter((t) => t.areaId === p1Active.id && t.status === "pending")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const nextTask = openOnArea[0] ?? null;

  void areaMap;

  const parts: string[] = [];
  parts.push(`${p1Active.name} (${p1Active.priority ?? "P3"}) stays the headline.`);
  if (topMilestone) {
    parts.push(`Push "${topMilestone.title}".`);
  }
  if (nextTask) {
    const next = nextTask.suggestedNextStep ?? nextTask.title;
    parts.push(`Next concrete step: ${next}.`);
  }
  return parts.join(" ");
}

export function buildRulesDraft(input: ReflectionDraftInput): ReflectionDraft {
  const areaMap = new Map<number, Area>(input.areas.map((a) => [a.id, a]));
  return {
    moved: buildMoved(input, areaMap),
    stuck: buildStuck(input, areaMap),
    drop: buildDrop(input, areaMap),
    nextFocus: buildNextFocus(input, areaMap),
    source: "rules",
    generatedAt: input.now.toISOString(),
  };
}

export function buildEmptyFallback(input: ReflectionDraftInput): ReflectionDraft {
  return {
    moved: `No moves ${input.periodLabel}. Pick an area to focus on.`,
    stuck: `Nothing flagged as stuck ${input.periodLabel}.`,
    drop: `Nothing obvious to drop.`,
    nextFocus: `Pick one area to make active next ${input.cadence === "week" ? "week" : "month"} and the plan will draft from it.`,
    source: "fallback",
    generatedAt: input.now.toISOString(),
  };
}
