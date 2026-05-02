import { and, desc, eq, gte, lte, lt, sql } from "drizzle-orm";
import {
  db,
  tasksTable,
  areasTable,
  milestonesTable,
  weeklyPlansTable,
  progressLogsTable,
  dailyBriefingsTable,
} from "@workspace/db";
import { buildRulesBriefing } from "./rules";
import { buildAiBriefing } from "./ai";
import type { BriefingInput, BriefingResponse } from "./types";
import { logger } from "../logger";
import { shouldServeFromCache } from "./cache";
import { computeHeldMilestoneIds } from "./holds";

export type BriefingDeps = {
  now?: Date;
  hint?: string;
  bypassCache?: boolean;
  userId?: string | null;
  userFirstName?: string;
  focusBlockMinutes?: number;
};

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function loadInput(deps: BriefingDeps): Promise<BriefingInput> {
  const now = deps.now ?? new Date();
  const date = now.toISOString().slice(0, 10);
  const weekOf = getWeekStart(now);
  const weekEnd = getWeekEnd(weekOf);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [pillars, plans, openTasks, recentlyCompleted, recentLogs, milestones] = await Promise.all([
    db.select().from(areasTable).orderBy(areasTable.id),
    db
      .select()
      .from(weeklyPlansTable)
      .where(eq(weeklyPlansTable.weekOf, weekOf)),
    db
      .select()
      .from(tasksTable)
      .where(
        and(
          gte(tasksTable.date, weekOf),
          lte(tasksTable.date, weekEnd),
        ),
      )
      .orderBy(desc(tasksTable.createdAt)),
    db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.status, "done"),
          gte(tasksTable.date, sevenDaysAgo),
          lt(tasksTable.date, date),
        ),
      )
      .orderBy(desc(tasksTable.date), desc(tasksTable.id))
      .limit(10),
    db
      .select()
      .from(progressLogsTable)
      .orderBy(desc(progressLogsTable.loggedAt))
      .limit(20),
    db.select().from(milestonesTable),
  ]);

  const open = openTasks.filter((t) => t.status === "pending" || t.status === "blocked");
  const activePillars = pillars.filter((p) => p.isActiveThisWeek);

  // Phase 3: for goals ("milestones") with mode="ordered", only the
  // lowest-sortOrder pending task is eligible for the briefing. Later
  // steps stay hidden until earlier ones close. "Can't wash dishes if
  // I haven't collected them." Applied here so both rules-based and
  // AI briefings respect the rule.
  const orderedMilestoneIds = new Set(
    milestones.filter((m) => m.mode === "ordered").map((m) => m.id),
  );
  const minSortByMilestone = new Map<number, number>();
  for (const t of open) {
    if (t.status !== "pending") continue;
    if (t.milestoneId == null) continue;
    if (!orderedMilestoneIds.has(t.milestoneId)) continue;
    const cur = minSortByMilestone.get(t.milestoneId);
    if (cur === undefined || t.sortOrder < cur) {
      minSortByMilestone.set(t.milestoneId, t.sortOrder);
    }
  }
  // Phase deps: skip tasks whose milestone is on hold. Held milestones
  // still appear in input.milestones so the rules layer can quote them
  // in reasoning, but their tasks never make it into the open-task pool.
  const heldMilestoneIds = computeHeldMilestoneIds(milestones);
  const filteredOpen = open.filter((t) => {
    if (t.milestoneId != null && heldMilestoneIds.has(t.milestoneId)) return false;
    if (t.status !== "pending") return true;
    if (t.milestoneId == null) return true;
    if (!orderedMilestoneIds.has(t.milestoneId)) return true;
    const min = minSortByMilestone.get(t.milestoneId);
    return min === undefined || t.sortOrder === min;
  });

  return {
    date,
    now,
    hourLocal: now.getHours(),
    userFirstName: deps.userFirstName ?? "Theresa",
    pillars,
    activePillars,
    weeklyPlan: plans[0] ?? null,
    openTasks: filteredOpen,
    recentlyCompleted,
    recentLogs,
    milestones,
    focusBlockMinutes: deps.focusBlockMinutes ?? 25,
    hint: deps.hint,
  };
}

export async function loadCachedBriefing(
  userId: string | null,
  date: string,
): Promise<{ row: typeof dailyBriefingsTable.$inferSelect; briefing: BriefingResponse } | null> {
  const rows = await db
    .select()
    .from(dailyBriefingsTable)
    .where(
      and(
        userId === null
          ? sql`${dailyBriefingsTable.userId} IS NULL`
          : eq(dailyBriefingsTable.userId, userId),
        eq(dailyBriefingsTable.date, date),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const briefing = row.briefingJson as BriefingResponse;
  return { row, briefing: { ...briefing, approved: row.approvedAt !== null } };
}

async function persistBriefing(
  userId: string | null,
  date: string,
  briefing: BriefingResponse,
): Promise<void> {
  const value = {
    userId,
    date,
    briefingJson: briefing,
    source: briefing.source,
    generatedAt: new Date(briefing.generatedAt),
  };
  await db
    .insert(dailyBriefingsTable)
    .values(value)
    .onConflictDoUpdate({
      target: [dailyBriefingsTable.userId, dailyBriefingsTable.date],
      set: {
        briefingJson: value.briefingJson,
        source: value.source,
        generatedAt: value.generatedAt,
        approvedAt: null,
      },
    });
}

export async function generateBriefing(deps: BriefingDeps = {}): Promise<BriefingResponse> {
  const userId = deps.userId ?? null;
  const input = await loadInput(deps);

  const cached = !deps.bypassCache && !deps.hint
    ? await loadCachedBriefing(userId, input.date)
    : null;
  if (
    cached &&
    shouldServeFromCache(cached.briefing, {
      hint: deps.hint,
      bypassCache: deps.bypassCache,
      now: deps.now,
    })
  ) {
    return cached.briefing;
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  let briefing: BriefingResponse;
  if (apiKey && apiKey.trim().length > 0) {
    try {
      briefing = await buildAiBriefing(input, { apiKey: apiKey.trim() });
    } catch (err) {
      logger.warn({ err: String(err) }, "AI briefing failed, falling back to rules");
      briefing = { ...buildRulesBriefing(input), source: "fallback" };
    }
  } else {
    briefing = buildRulesBriefing(input);
  }

  try {
    await persistBriefing(userId, input.date, briefing);
  } catch (err) {
    logger.warn({ err: String(err) }, "Failed to persist briefing");
  }

  return briefing;
}

export async function approveBriefingForToday(
  userId: string | null,
  now: Date = new Date(),
): Promise<BriefingResponse | null> {
  const date = now.toISOString().slice(0, 10);
  const cached = await loadCachedBriefing(userId, date);
  if (!cached) return null;
  await db
    .update(dailyBriefingsTable)
    .set({ approvedAt: now })
    .where(eq(dailyBriefingsTable.id, cached.row.id));
  return { ...cached.briefing, approved: true };
}
