import { and, eq, sql } from "drizzle-orm";
import {
  db,
  tasksTable,
  areasTable,
  dailyBriefingsTable,
} from "@workspace/db";
import { buildRulesRecap } from "./rules";
import { buildAiRecap } from "./ai";
import type { RecapInput, RecapResponse } from "./types";
import { logger } from "../logger";
import { readOpenAiApiKey } from "../openai-key";
import { shouldServeFromCache } from "./cache";

export type RecapDeps = {
  now?: Date;
  bypassCache?: boolean;
  userId?: string | null;
  userFirstName?: string;
};

const RECAP_KIND = "evening";

function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function loadInput(deps: RecapDeps): Promise<RecapInput> {
  const now = deps.now ?? new Date();
  const date = dateKey(now);
  const userId = deps.userId ?? null;

  const pillarsCondition = userId === null ? undefined : eq(areasTable.userId, userId);
  const tasksCondition = userId === null
    ? eq(tasksTable.date, date)
    : and(eq(tasksTable.userId, userId), eq(tasksTable.date, date));

  const [pillars, todayTasks] = await Promise.all([
    pillarsCondition
      ? db.select().from(areasTable).where(pillarsCondition).orderBy(areasTable.id)
      : db.select().from(areasTable).orderBy(areasTable.id),
    db.select().from(tasksTable).where(tasksCondition),
  ]);

  const closedToday = todayTasks.filter((t) => t.status === "done");
  const openToday = todayTasks.filter(
    (t) => t.status === "pending" || t.status === "blocked",
  );

  // Stable rotation of reflection prompt across days.
  const reflectionPromptIndex = Math.abs(
    [...date].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0),
  );

  return {
    date,
    now,
    hourLocal: now.getHours(),
    userFirstName: deps.userFirstName ?? "Theresa",
    pillars,
    closedToday,
    openToday,
    reflectionPromptIndex,
  };
}

export async function loadCachedRecap(
  userId: string | null,
  date: string,
): Promise<{ row: typeof dailyBriefingsTable.$inferSelect; recap: RecapResponse } | null> {
  const rows = await db
    .select()
    .from(dailyBriefingsTable)
    .where(
      and(
        userId === null
          ? sql`${dailyBriefingsTable.userId} IS NULL`
          : eq(dailyBriefingsTable.userId, userId),
        eq(dailyBriefingsTable.date, date),
        eq(dailyBriefingsTable.kind, RECAP_KIND),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const recap = row.briefingJson as RecapResponse;
  return { row, recap: { ...recap, reflection: row.reflection ?? recap.reflection ?? null } };
}

async function persistRecap(
  userId: string | null,
  date: string,
  recap: RecapResponse,
): Promise<void> {
  const value = {
    userId,
    date,
    kind: RECAP_KIND,
    briefingJson: recap,
    source: recap.source,
    generatedAt: new Date(recap.generatedAt),
    reflection: recap.reflection,
  };
  await db
    .insert(dailyBriefingsTable)
    .values(value)
    .onConflictDoUpdate({
      target: [dailyBriefingsTable.userId, dailyBriefingsTable.date, dailyBriefingsTable.kind],
      set: {
        briefingJson: value.briefingJson,
        source: value.source,
        generatedAt: value.generatedAt,
        reflection: value.reflection,
      },
    });
}

async function loadDoneCount(
  userId: string | null,
  date: string,
): Promise<number> {
  const condition = userId === null
    ? and(eq(tasksTable.date, date), eq(tasksTable.status, "done"))
    : and(
        eq(tasksTable.userId, userId),
        eq(tasksTable.date, date),
        eq(tasksTable.status, "done"),
      );
  const rows = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(condition);
  return rows.length;
}


export async function generateRecap(deps: RecapDeps = {}): Promise<RecapResponse> {
  const userId = deps.userId ?? null;
  const input = await loadInput(deps);

  const cached = !deps.bypassCache
    ? await loadCachedRecap(userId, input.date)
    : null;
  if (cached) {
    const currentDoneCount = await loadDoneCount(userId, input.date).catch(() => undefined);
    if (
      shouldServeFromCache(cached.recap, {
        bypassCache: deps.bypassCache,
        now: deps.now,
        currentDoneCount,
      })
    ) {
      return cached.recap;
    }
  }

  const apiKey = readOpenAiApiKey();
  let recap: RecapResponse;
  if (apiKey) {
    try {
      recap = await buildAiRecap(input, { apiKey });
    } catch (err) {
      logger.warn({ err: String(err) }, "AI recap failed, falling back to rules");
      recap = { ...buildRulesRecap(input), source: "fallback" };
    }
  } else {
    recap = buildRulesRecap(input);
  }

  // Preserve any existing reflection across regeneration.
  if (cached?.recap.reflection) {
    recap = { ...recap, reflection: cached.recap.reflection };
  }

  try {
    await persistRecap(userId, input.date, recap);
  } catch (err) {
    logger.warn({ err: String(err) }, "Failed to persist recap");
  }

  return recap;
}

export async function saveRecapReflection(
  userId: string | null,
  reflection: string,
  now: Date = new Date(),
): Promise<RecapResponse | null> {
  const date = dateKey(now);
  const cached = await loadCachedRecap(userId, date);
  if (!cached) return null;
  const trimmed = reflection.trim().slice(0, 500);
  await db
    .update(dailyBriefingsTable)
    .set({ reflection: trimmed.length > 0 ? trimmed : null })
    .where(eq(dailyBriefingsTable.id, cached.row.id));
  return { ...cached.recap, reflection: trimmed.length > 0 ? trimmed : null };
}
