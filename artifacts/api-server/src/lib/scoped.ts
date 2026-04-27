import { eq } from "drizzle-orm";
import {
  pillarsTable,
  tasksTable,
  milestonesTable,
  weeklyPlansTable,
  monthlyReviewsTable,
  progressLogsTable,
} from "@workspace/db/schema";

/**
 * `scoped(userId)` returns user-scoped helpers for every multi-tenant table.
 *
 * Each helper exposes:
 *   - `owns`: a Drizzle predicate (`eq(table.userId, userId)`) you can pass
 *      to `.where(...)` or combine with `and(...)`.
 *   - `withUser`: stamps `{ userId }` onto an insert payload.
 *
 * Usage:
 *   const s = scoped(req.userId!);
 *   const rows = await db.select().from(pillarsTable).where(s.pillars.owns);
 *   await db.insert(pillarsTable).values(s.pillars.withUser({ name: "X" }));
 */
export function scoped(userId: string) {
  if (!userId) {
    throw new Error("scoped(): userId is required");
  }

  return {
    pillars: {
      owns: eq(pillarsTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
    tasks: {
      owns: eq(tasksTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
    milestones: {
      owns: eq(milestonesTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
    weeklyPlans: {
      owns: eq(weeklyPlansTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
    monthlyReviews: {
      owns: eq(monthlyReviewsTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
    progressLogs: {
      owns: eq(progressLogsTable.userId, userId),
      withUser: <T extends Record<string, unknown>>(values: T) => ({ ...values, userId }),
    },
  };
}

export type Scoped = ReturnType<typeof scoped>;

/**
 * Helper: pull `req.userId` (set by requireAuth) and refuse if it's missing.
 * Routes should always run after requireAuth, so this is a guard against
 * accidental misconfiguration rather than a runtime expectation.
 */
export function userIdFrom(req: { userId?: string }): string {
  const id = req.userId;
  if (!id) {
    throw new Error("userIdFrom(): req.userId is missing — is requireAuth wired up?");
  }
  return id;
}
