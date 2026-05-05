import type { BriefingInput, BriefingResponse } from "./types";

export function enrichBriefingWithGoals(
  briefing: BriefingResponse,
  input: BriefingInput,
): BriefingResponse {
  const milestoneById = new Map(input.milestones.map((m) => [m.id, m]));
  const taskMilestoneById = new Map<number, number | null>();
  for (const t of input.openTasks) taskMilestoneById.set(t.id, t.milestoneId);
  for (const t of input.recentlyCompleted) taskMilestoneById.set(t.id, t.milestoneId);

  return {
    ...briefing,
    briefing: briefing.briefing.map((item) => {
      if (typeof item.taskId !== "number") return { ...item, goalId: null, goalTitle: null };
      const milestoneId = taskMilestoneById.get(item.taskId) ?? null;
      if (milestoneId === null) return { ...item, goalId: null, goalTitle: null };
      const milestone = milestoneById.get(milestoneId);
      if (!milestone) return { ...item, goalId: null, goalTitle: null };
      return { ...item, goalId: milestone.id, goalTitle: milestone.title };
    }),
  };
}
