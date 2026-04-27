import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";

interface FakeUser {
  id: string;
  plan: "free" | "pro";
  pillars: number;
  activeTasks: number;
}

const state: { users: Map<string, FakeUser> } = { users: new Map() };

function reset(initial: FakeUser[]): void {
  state.users.clear();
  for (const u of initial) state.users.set(u.id, u);
}

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", plan: "plan" } as unknown;
  const pillarsTable = { userId: "userId" } as unknown;
  const tasksTable = { userId: "userId", status: "status" } as unknown;

  // The plan helper builds where-clauses with eq()/and()/inArray(), then runs
  // db.select(...).from(table).where(predicate). We don't care about the
  // predicate; we just inspect which table is being queried + carry the
  // current userId through select() chain via a side channel.
  let lastUserId: string | null = null;

  const select = (_columns?: unknown) => {
    return {
      from: (table: unknown) => {
        return {
          where: (predicate: unknown) => {
            // Predicates are objects produced by eq(...). We stashed the userId
            // in our drizzle-orm mock below.
            const p = predicate as { userId?: string };
            if (p.userId) lastUserId = p.userId;
            const userId = lastUserId ?? "";
            const user = state.users.get(userId);
            if (table === usersTable) {
              return user ? [{ plan: user.plan }] : [];
            }
            if (table === pillarsTable) {
              return user ? new Array(user.pillars).fill({ id: 1 }) : [];
            }
            if (table === tasksTable) {
              return user ? new Array(user.activeTasks).fill({ id: 1 }) : [];
            }
            return [];
          },
        };
      },
    };
  };

  const db = {
    select,
  };

  return {
    db,
    usersTable,
    pillarsTable,
    tasksTable,
  };
});

vi.mock("drizzle-orm", () => {
  return {
    and: (...args: unknown[]) => Object.assign({}, ...args.map((a) => (a ?? {}) as object)),
    eq: (col: unknown, val: unknown) => {
      // For pillarsTable.userId / tasksTable.userId / usersTable.id, the
      // value is the userId we want to scope by. Pass through so the mocked
      // .where() can read it.
      if (typeof val === "string") return { userId: val };
      return {};
    },
    inArray: () => ({}),
  };
});

describe("plan gating (Stripe enabled, Clerk enabled — full enforcement)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.CLERK_SECRET_KEY = "sk_test_clerk";
    process.env.STRIPE_SECRET_KEY = "sk_test_stripe";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("free user is blocked at the 3-pillar limit", async () => {
    reset([{ id: "u1", plan: "free", pillars: 3, activeTasks: 0 }]);
    const { assertCanCreatePillar } = await import("../plan");
    await expect(assertCanCreatePillar("u1")).rejects.toMatchObject({
      status: 403,
      code: "PLAN_LIMIT",
    });
  });

  it("free user under the limit is not blocked", async () => {
    reset([{ id: "u2", plan: "free", pillars: 2, activeTasks: 0 }]);
    const { assertCanCreatePillar } = await import("../plan");
    await expect(assertCanCreatePillar("u2")).resolves.toBeUndefined();
  });

  it("pro user is not blocked even with many pillars", async () => {
    reset([{ id: "u3", plan: "pro", pillars: 50, activeTasks: 0 }]);
    const { assertCanCreatePillar } = await import("../plan");
    await expect(assertCanCreatePillar("u3")).resolves.toBeUndefined();
  });

  it("free user is blocked at the 10-active-task limit", async () => {
    reset([{ id: "u4", plan: "free", pillars: 0, activeTasks: 10 }]);
    const { assertCanCreateTask } = await import("../plan");
    await expect(assertCanCreateTask("u4")).rejects.toMatchObject({
      status: 403,
      code: "PLAN_LIMIT",
    });
  });

  it("free user cannot export CSV; pro can", async () => {
    reset([
      { id: "free1", plan: "free", pillars: 0, activeTasks: 0 },
      { id: "pro1", plan: "pro", pillars: 0, activeTasks: 0 },
    ]);
    const { assertCanExport } = await import("../plan");
    await expect(assertCanExport("free1")).rejects.toMatchObject({ code: "PLAN_LIMIT" });
    await expect(assertCanExport("pro1")).resolves.toBeUndefined();
  });
});

describe("plan gating bypasses", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("owner mode (CLERK_SECRET_KEY unset) bypasses plan checks", async () => {
    delete process.env.CLERK_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_stripe";
    reset([{ id: "owner", plan: "free", pillars: 99, activeTasks: 99 }]);
    const { assertCanCreatePillar, assertCanCreateTask, assertCanExport } = await import("../plan");
    await expect(assertCanCreatePillar("owner")).resolves.toBeUndefined();
    await expect(assertCanCreateTask("owner")).resolves.toBeUndefined();
    await expect(assertCanExport("owner")).resolves.toBeUndefined();
  });

  it("Stripe-not-configured (STRIPE_SECRET_KEY unset) bypasses plan checks", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_clerk";
    delete process.env.STRIPE_SECRET_KEY;
    reset([{ id: "u5", plan: "free", pillars: 99, activeTasks: 99 }]);
    const { assertCanCreatePillar, assertCanCreateTask, assertCanExport } = await import("../plan");
    await expect(assertCanCreatePillar("u5")).resolves.toBeUndefined();
    await expect(assertCanCreateTask("u5")).resolves.toBeUndefined();
    await expect(assertCanExport("u5")).resolves.toBeUndefined();
  });
});
