import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  tasksTable,
  areasTable,
  milestonesTable,
  progressLogsTable,
} from "@workspace/db";
import { buildAiDraft } from "./ai";
import { buildEmptyFallback, buildRulesDraft } from "./rules";
import { getCachedDraft, makeCacheKey, setCachedDraft } from "./cache";
import type { ReflectionCadence, ReflectionDraft, ReflectionDraftInput } from "./types";
import { logger } from "../logger";
import { readOpenAiApiKey } from "../openai-key";

export type DraftRequest = {
  cadence: ReflectionCadence;
  // For week: YYYY-MM-DD (Monday). For month: YYYY-MM.
  periodKey: string;
  userId?: string | null;
  bypassCache?: boolean;
  now?: Date;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveWeekRange(weekOf: string): { start: string; end: string; label: string } {
  const start = new Date(`${weekOf}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: isoDate(start), end: isoDate(end), label: "this week" };
}

function resolveMonthRange(monthOf: string): { start: string; end: string; label: string } {
  // monthOf is "YYYY-MM" — derive a 30-day window ending on the last day
  // of the month, but treat the period as the calendar month.
  const [yStr, mStr] = monthOf.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const label = start.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start: isoDate(start), end: isoDate(end), label };
}

async function loadInput(req: DraftRequest): Promise<ReflectionDraftInput> {
  const now = req.now ?? new Date();
  const range = req.cadence === "week" ? resolveWeekRange(req.periodKey) : resolveMonthRange(req.periodKey);
  const userId = req.userId ?? null;

  const [areas, completedTasks, openTasks, recentLogs, milestones] = await Promise.all([
    userId === null
      ? db.select().from(areasTable).orderBy(areasTable.id)
      : db.select().from(areasTable).where(eq(areasTable.userId, userId)).orderBy(areasTable.id),
    db
      .select()
      .from(tasksTable)
      .where(
        userId === null
          ? and(
              eq(tasksTable.status, "done"),
              gte(tasksTable.date, range.start),
              lte(tasksTable.date, range.end),
            )
          : and(
              eq(tasksTable.userId, userId),
              eq(tasksTable.status, "done"),
              gte(tasksTable.date, range.start),
              lte(tasksTable.date, range.end),
            ),
      )
      .orderBy(desc(tasksTable.date), desc(tasksTable.id)),
    db
      .select()
      .from(tasksTable)
      .where(
        userId === null
          ? and(
              gte(tasksTable.date, range.start),
              lte(tasksTable.date, range.end),
            )
          : and(
              eq(tasksTable.userId, userId),
              gte(tasksTable.date, range.start),
              lte(tasksTable.date, range.end),
            ),
      ),
    userId === null
      ? db.select().from(progressLogsTable).orderBy(desc(progressLogsTable.loggedAt)).limit(40)
      : db.select().from(progressLogsTable).where(eq(progressLogsTable.userId, userId)).orderBy(desc(progressLogsTable.loggedAt)).limit(40),
    userId === null
      ? db.select().from(milestonesTable)
      : db.select().from(milestonesTable).where(eq(milestonesTable.userId, userId)),
  ]);

  const open = openTasks.filter((t) => t.status !== "done");
  const activeAreas = areas.filter((a) => a.isActiveThisWeek);

  return {
    cadence: req.cadence,
    periodStart: range.start,
    periodEnd: range.end,
    periodLabel: range.label,
    now,
    areas,
    activeAreas,
    completedTasks,
    openTasks: open,
    recentLogs,
    milestones,
  };
}

export type GenerateDraftDeps = DraftRequest & {
  // Test seam: skip db loading and use this input directly.
  input?: ReflectionDraftInput;
};

export async function generateReflectionDraft(deps: GenerateDraftDeps): Promise<ReflectionDraft> {
  const userId = deps.userId ?? null;
  const cacheKey = makeCacheKey(userId, deps.cadence, deps.periodKey);

  if (!deps.bypassCache) {
    const cached = getCachedDraft(cacheKey, deps.now);
    if (cached) return cached;
  }

  const input = deps.input ?? (await loadInput(deps));

  const hasAnyData =
    input.completedTasks.length > 0 ||
    input.openTasks.length > 0 ||
    input.activeAreas.length > 0;

  let draft: ReflectionDraft;

  const apiKey = readOpenAiApiKey();
  if (apiKey && hasAnyData) {
    try {
      draft = await buildAiDraft(input, { apiKey });
      // Guard: if AI returned all-empty, fall back to rules.
      if (!draft.moved && !draft.stuck && !draft.drop && !draft.nextFocus) {
        draft = { ...buildRulesDraft(input), source: "fallback" };
      }
    } catch (err) {
      logger.warn({ err: String(err) }, "AI reflection draft failed, falling back to rules");
      draft = { ...buildRulesDraft(input), source: "fallback" };
    }
  } else if (hasAnyData) {
    draft = buildRulesDraft(input);
  } else {
    draft = buildEmptyFallback(input);
  }

  setCachedDraft(cacheKey, draft);
  return draft;
}
