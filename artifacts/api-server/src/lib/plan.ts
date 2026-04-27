// Plan gating helpers. Free users have hard caps; Pro users are unlimited.
//
// Two bypasses (must be preserved):
//   1. Owner mode (CLERK_SECRET_KEY unset) — Theresa always has full access.
//   2. Stripe-not-configured (STRIPE_SECRET_KEY unset) — dev/early-adopter
//      setups treat everyone as Pro.
import { and, eq, inArray } from "drizzle-orm";
import { db, usersTable, pillarsTable, tasksTable } from "@workspace/db";
import { ApiError } from "./errors";
import { isStripeEnabled } from "./stripe";

const CLERK_SECRET = process.env["CLERK_SECRET_KEY"];

export const FREE_PILLAR_LIMIT = 3;
export const FREE_ACTIVE_TASK_LIMIT = 10;
export const ACTIVE_TASK_STATUSES = ["pending", "stepped_back"] as const;

export type Plan = "free" | "pro";

export interface PlanLimitDetails {
  code: "PLAN_LIMIT";
  limit: number;
  current: number;
  plan: Plan;
  resource: "pillars" | "tasks" | "export";
}

function planLimitError(details: PlanLimitDetails, message: string): ApiError {
  return new ApiError(403, "PLAN_LIMIT", message, details);
}

export function isOwnerMode(): boolean {
  return !CLERK_SECRET;
}

/**
 * Returns true when plan checks should be skipped entirely. Either we are in
 * owner mode (no Clerk) or Stripe isn't configured (no billing pipeline).
 */
export function shouldBypassPlanChecks(): boolean {
  return isOwnerMode() || !isStripeEnabled();
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const [row] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const value = row?.plan ?? "free";
  return value === "pro" ? "pro" : "free";
}

async function countPillars(userId: string): Promise<number> {
  const rows = await db
    .select({ id: pillarsTable.id })
    .from(pillarsTable)
    .where(eq(pillarsTable.userId, userId));
  return rows.length;
}

async function countActiveTasks(userId: string): Promise<number> {
  const rows = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, userId),
        inArray(tasksTable.status, ACTIVE_TASK_STATUSES as unknown as string[]),
      ),
    );
  return rows.length;
}

export async function assertCanCreatePillar(userId: string): Promise<void> {
  if (shouldBypassPlanChecks()) return;
  const plan = await getUserPlan(userId);
  if (plan === "pro") return;
  const current = await countPillars(userId);
  if (current >= FREE_PILLAR_LIMIT) {
    throw planLimitError(
      {
        code: "PLAN_LIMIT",
        limit: FREE_PILLAR_LIMIT,
        current,
        plan,
        resource: "pillars",
      },
      `Free plan is limited to ${FREE_PILLAR_LIMIT} pillars. Upgrade to Pro for unlimited pillars.`,
    );
  }
}

export async function assertCanCreateTask(userId: string): Promise<void> {
  if (shouldBypassPlanChecks()) return;
  const plan = await getUserPlan(userId);
  if (plan === "pro") return;
  const current = await countActiveTasks(userId);
  if (current >= FREE_ACTIVE_TASK_LIMIT) {
    throw planLimitError(
      {
        code: "PLAN_LIMIT",
        limit: FREE_ACTIVE_TASK_LIMIT,
        current,
        plan,
        resource: "tasks",
      },
      `Free plan is limited to ${FREE_ACTIVE_TASK_LIMIT} active tasks. Upgrade to Pro for unlimited tasks.`,
    );
  }
}

export async function assertCanExport(userId: string): Promise<void> {
  if (shouldBypassPlanChecks()) return;
  const plan = await getUserPlan(userId);
  if (plan === "pro") return;
  throw planLimitError(
    {
      code: "PLAN_LIMIT",
      limit: 0,
      current: 0,
      plan,
      resource: "export",
    },
    "CSV export is a Pro feature. Upgrade to Pro to export your data.",
  );
}

export interface PlanUsage {
  plan: Plan;
  pillars: { used: number; limit: number | null };
  tasks: { used: number; limit: number | null };
  canExport: boolean;
  bypassed: boolean;
}

export async function getPlanUsage(userId: string): Promise<PlanUsage> {
  const bypassed = shouldBypassPlanChecks();
  const plan: Plan = bypassed ? "pro" : await getUserPlan(userId);
  const pillarsUsed = await countPillars(userId);
  const tasksUsed = await countActiveTasks(userId);
  const isPro = plan === "pro";
  return {
    plan,
    pillars: { used: pillarsUsed, limit: isPro ? null : FREE_PILLAR_LIMIT },
    tasks: { used: tasksUsed, limit: isPro ? null : FREE_ACTIVE_TASK_LIMIT },
    canExport: isPro,
    bypassed,
  };
}

