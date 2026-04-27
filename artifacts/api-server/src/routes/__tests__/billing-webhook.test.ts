import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";

process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";

interface UpdateCall {
  set: Record<string, unknown>;
  whereKind: "id" | "stripeCustomerId" | null;
  whereValue: string | null;
}

const updates: UpdateCall[] = [];
let pendingWhereKind: "id" | "stripeCustomerId" | null = null;

vi.mock("@workspace/db", () => {
  const usersTable = {
    id: "users.id",
    stripeCustomerId: "users.stripeCustomerId",
  } as unknown;

  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (predicate: { __kind: "id" | "stripeCustomerId"; __value: string }) => {
          updates.push({
            set: values,
            whereKind: predicate.__kind ?? pendingWhereKind,
            whereValue: predicate.__value ?? null,
          });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { db, usersTable };
});

vi.mock("drizzle-orm", () => {
  return {
    eq: (col: unknown, value: string) => {
      // We can't easily compare object identity for the mocked usersTable
      // members, so we infer from the column string above.
      const kind = String(col).endsWith("stripeCustomerId") ? "stripeCustomerId" : "id";
      pendingWhereKind = kind;
      return { __kind: kind, __value: value };
    },
    sql: (..._args: unknown[]) => ({ __sql: true }),
  };
});

beforeEach(() => {
  updates.length = 0;
  pendingWhereKind = null;
});

afterEach(() => {
  vi.resetModules();
});

describe("Stripe webhook handler", () => {
  it("checkout.session.completed sets user's plan to 'pro' and stores subscription metadata", async () => {
    const { handleWebhookEvent } = await import("../billing");

    const subscription = {
      id: "sub_123",
      status: "active",
      current_period_end: Math.floor(new Date("2026-08-01T00:00:00Z").getTime() / 1000),
    } as unknown as Stripe.Subscription;

    const stripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue(subscription),
      },
    } as unknown as Stripe;

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          subscription: "sub_123",
          metadata: { userId: "user_abc" },
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, stripe);

    expect(updates).toHaveLength(1);
    const u = updates[0]!;
    expect(u.set).toMatchObject({
      plan: "pro",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "active",
    });
    expect(u.whereKind).toBe("id");
    expect(u.whereValue).toBe("user_abc");
  });

  it("customer.subscription.deleted downgrades the user to free and clears subscription id", async () => {
    const { handleWebhookEvent } = await import("../billing");

    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_999",
          customer: "cus_999",
          status: "canceled",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, {} as Stripe);

    expect(updates).toHaveLength(1);
    const u = updates[0]!;
    expect(u.set).toMatchObject({
      plan: "free",
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
    });
    expect(u.whereKind).toBe("stripeCustomerId");
    expect(u.whereValue).toBe("cus_999");
  });

  it("customer.subscription.updated keeps user pro on active status", async () => {
    const { handleWebhookEvent } = await import("../billing");

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, {} as Stripe);
    expect(updates[0]!.set).toMatchObject({ plan: "pro", subscriptionStatus: "active" });
  });

  it("customer.subscription.updated downgrades on canceled status", async () => {
    const { handleWebhookEvent } = await import("../billing");

    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_2",
          customer: "cus_2",
          status: "canceled",
        },
      },
    } as unknown as Stripe.Event;

    await handleWebhookEvent(event, {} as Stripe);
    expect(updates[0]!.set).toMatchObject({ plan: "free" });
  });

  it("ignores unknown event types without throwing", async () => {
    const { handleWebhookEvent } = await import("../billing");
    const event = { type: "ping", data: { object: {} } } as unknown as Stripe.Event;
    await expect(handleWebhookEvent(event, {} as Stripe)).resolves.toBeUndefined();
    expect(updates).toHaveLength(0);
  });
});
