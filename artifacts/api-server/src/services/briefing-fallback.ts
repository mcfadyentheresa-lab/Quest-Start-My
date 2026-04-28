/**
 * Pure-data briefing renderer. Intentionally has no db imports so the unit
 * test for the rules-based fallback (run without DATABASE_URL) can exercise
 * it directly. Keep it free of side effects — anything that reaches Postgres
 * lives in services/briefing.ts and feeds this function via BriefingContext.
 */

export interface BriefingContext {
  todayDate: string;
  weekOf: string;
  tasks: { id: number; title: string; status: string; areaId: number | null }[];
  areas: { id: number; name: string }[];
  weeklyPriorities: string[];
  weeklyAreaIds: number[];
}

export interface Briefing {
  /** Short narrative paragraph the chief-of-staff card displays. */
  narrative: string;
  /** Whether this came from the LLM or the rules-based fallback. */
  source: "llm" | "fallback";
}

export function buildFallbackBriefing(ctx: BriefingContext): Briefing {
  const areaById = new Map(ctx.areas.map((a) => [a.id, a.name]));
  const pendingTasks = ctx.tasks.filter((t) => t.status === "pending");
  const taskCount = ctx.tasks.length;

  const lines: string[] = [];

  if (taskCount === 0) {
    lines.push("Nothing on today's list yet — pick one or two small actions to get started.");
  } else {
    const counts = new Map<number | null, number>();
    for (const t of ctx.tasks) {
      const k = t.areaId ?? null;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const namedGroups = Array.from(counts.entries())
      .filter(([k]) => k !== null && areaById.has(k as number))
      .map(([k, n]) => ({ name: areaById.get(k as number)!, n }))
      .sort((a, b) => b.n - a.n);

    if (namedGroups.length === 0) {
      lines.push(`Today's ${taskCount} task${taskCount === 1 ? "" : "s"} aren't scoped to an area yet.`);
    } else if (namedGroups.length === 1) {
      const g = namedGroups[0]!;
      lines.push(`Today's ${taskCount} task${taskCount === 1 ? "" : "s"} ladder up to *${g.name}*.`);
    } else {
      const parts = namedGroups.map((g) => `*${g.name}* (${g.n})`);
      const last = parts.pop()!;
      lines.push(`Today's ${taskCount} tasks span ${parts.join(", ")} and ${last}.`);
    }
  }

  if (ctx.weeklyAreaIds.length > 0) {
    const focusNames = ctx.weeklyAreaIds
      .map((id) => areaById.get(id))
      .filter((n): n is string => Boolean(n));
    if (focusNames.length > 0) {
      const focus = focusNames.length === 1 ? focusNames[0] : focusNames.join(" and ");
      lines.push(`Your weekly focus is *${focus}* — let's start there.`);
    }
  } else if (ctx.weeklyPriorities.length > 0) {
    lines.push(`Top priority this week: "${ctx.weeklyPriorities[0]}".`);
  }

  if (pendingTasks.length === 0 && taskCount > 0) {
    lines.push("All today's tasks are already closed out — nice.");
  }

  return { narrative: lines.join(" "), source: "fallback" };
}
