import { db, areasTable, tasksTable, weeklyPlansTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  buildFallbackBriefing,
  type Briefing,
  type BriefingContext,
} from "./briefing-fallback";

export type { Briefing, BriefingContext };
export { buildFallbackBriefing };

/**
 * Build a structured context object the briefing renderer (rules-based or
 * LLM) consumes. Pure data access — no formatting decisions here.
 */
export async function loadBriefingContext(today: string, weekOf: string): Promise<BriefingContext> {
  const [tasks, areas, weeklyPlans] = await Promise.all([
    db.select().from(tasksTable).where(eq(tasksTable.date, today)),
    db.select().from(areasTable).orderBy(areasTable.id),
    db.select().from(weeklyPlansTable).where(eq(weeklyPlansTable.weekOf, weekOf)),
  ]);

  const plan = weeklyPlans[0];
  const weeklyAreaIds = (plan?.areaPriorities ?? []).map(Number).filter(Number.isFinite);

  return {
    todayDate: today,
    weekOf,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, areaId: t.areaId ?? null })),
    areas: areas.map((a) => ({ id: a.id, name: a.name })),
    weeklyPriorities: plan?.priorities ?? [],
    weeklyAreaIds,
  };
}

/**
 * Top-level briefing builder. If OPENAI_API_KEY is set, callers can swap in
 * an LLM call here later — for now we always use the rules-based fallback.
 * The fallback hard-codes the same area-grouping language the LLM prompt
 * would produce, so the user sees consistent narration either way.
 */
export async function buildBriefing(today: string, weekOf: string): Promise<Briefing> {
  const ctx = await loadBriefingContext(today, weekOf);
  return buildFallbackBriefing(ctx);
}
