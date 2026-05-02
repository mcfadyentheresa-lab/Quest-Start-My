import type { Milestone, Task } from "@workspace/db";

// Returns the set of milestone ids whose tasks should be excluded from
// the briefing because the milestone is on hold. A milestone is on hold
// when holdUntilMilestoneId points at another milestone that has not yet
// completed. Cycles are tolerated — the chain is walked once and any
// re-visit is treated as not-completed (held).
export function computeHeldMilestoneIds(milestones: ReadonlyArray<Milestone>): Set<number> {
  const byId = new Map<number, Milestone>();
  for (const m of milestones) byId.set(m.id, m);
  const held = new Set<number>();
  for (const m of milestones) {
    if (m.holdUntilMilestoneId == null) continue;
    const target = byId.get(m.holdUntilMilestoneId);
    if (target && target.completedAt === null) {
      held.add(m.id);
    }
  }
  return held;
}

// Filter open tasks to drop ones whose milestone is on hold. Pure; safe
// to call from anywhere a briefing-shaped task list is being built.
export function excludeHeldTasks(
  tasks: ReadonlyArray<Task>,
  milestones: ReadonlyArray<Milestone>,
): Task[] {
  const held = computeHeldMilestoneIds(milestones);
  if (held.size === 0) return tasks.slice();
  return tasks.filter((t) => t.milestoneId == null || !held.has(t.milestoneId));
}
