import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import express from "express";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { ApiError } from "../lib/errors";
import { logger } from "../lib/logger";
import { userIdFrom } from "../lib/scoped";
import {
  getStripe,
  isStripeEnabled,
  PRICE_MONTHLY,
  PRICE_YEARLY,
  WEBHOOK_SECRET,
  PORTAL_RETURN_URL,
} from "../lib/stripe";
import { getPlanUsage } from "../lib/plan";

// Public billing routes (status check + webhook). These must NOT be mounted
// behind requireAuth — Stripe never sends a Clerk token, and the status check
// is consumed by the frontend before sign-in to decide whether to render
// the billing UI.
export const billingPublicRouter: IRouter = Router();

// Authenticated billing routes (checkout, portal, usage).
export const billingAuthedRouter: IRouter = Router();

function notConfigured(): ApiError {
  return new ApiError(
    503,
    "BILLING_NOT_CONFIGURED",
    "Billing is not configured on this server.",
  );
}

function originFor(req: Request): string {
  const proto = (req.header("x-forwarded-proto") ?? req.protocol ?? "https").split(",")[0]!.trim();
  const host = req.header("x-forwarded-host") ?? req.header("host") ?? "localhost";
  return `${proto}://${host}`;
}

async function getOrCreateCustomerId(
  stripe: Stripe,
  userId: string,
): Promise<string> {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      stripeCustomerId: usersTable.stripeCustomerId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    throw ApiError.unauthorized("User row not found");
  }
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });

  await db
    .update(usersTable)
    .set({ stripeCustomerId: customer.id, updatedAt: sql`now()` })
    .where(eq(usersTable.id, userId));

  return customer.id;
}

// Public status endpoint: lets the frontend know whether billing is active
// without exposing keys. No auth required, no PII.
billingPublicRouter.get("/billing/status", (_req, res) => {
  res.json({
    enabled: isStripeEnabled(),
    prices: isStripeEnabled()
      ? {
          monthly: PRICE_MONTHLY ? "configured" : "missing",
          yearly: PRICE_YEARLY ? "configured" : "missing",
        }
      : null,
  });
});

// Webhook MUST be mounted before any JSON parser so the raw body survives for
// signature verification. The express.raw middleware is applied locally.
billingPublicRouter.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response, next: NextFunction) => {
    const stripe = getStripe();
    if (!stripe) {
      next(notConfigured());
      return;
    }
    if (!WEBHOOK_SECRET) {
      next(
        new ApiError(
          500,
          "BILLING_WEBHOOK_NOT_CONFIGURED",
          "Stripe webhook secret is not configured.",
        ),
      );
      return;
    }

    const signature = req.header("stripe-signature");
    if (!signature) {
      next(ApiError.badRequest("Missing stripe-signature header"));
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.warn({ err }, "Stripe: webhook signature verification failed");
      next(ApiError.badRequest("Invalid webhook signature"));
      return;
    }

    try {
      await handleWebhookEvent(event, stripe);
      res.json({ received: true });
    } catch (err) {
      logger.warn({ err, eventType: event.type }, "Stripe: webhook handler failed");
      next(err);
    }
  },
);

export async function handleWebhookEvent(
  event: Stripe.Event,
  stripe: Stripe,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.["userId"];
      if (!userId) {
        logger.warn({ sessionId: session.id }, "Stripe: checkout.session.completed missing userId metadata");
        return;
      }

      let subscriptionId: string | null = null;
      let status: string | null = null;
      let periodEnd: Date | null = null;
      if (typeof session.subscription === "string") {
        subscriptionId = session.subscription;
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        status = sub.status;
        periodEnd = periodEndFromSubscription(sub);
      } else if (session.subscription) {
        const sub = session.subscription as Stripe.Subscription;
        subscriptionId = sub.id;
        status = sub.status;
        periodEnd = periodEndFromSubscription(sub);
      }

      await db
        .update(usersTable)
        .set({
          plan: "pro",
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: status,
          currentPeriodEnd: periodEnd,
          updatedAt: sql`now()`,
        })
        .where(eq(usersTable.id, userId));
      return;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const status = sub.status;
      const periodEnd = periodEndFromSubscription(sub);
      const downgrade = status === "canceled" || status === "unpaid" || status === "incomplete_expired";
      await db
        .update(usersTable)
        .set({
          plan: downgrade ? "free" : "pro",
          stripeSubscriptionId: sub.id,
          subscriptionStatus: status,
          currentPeriodEnd: periodEnd,
          updatedAt: sql`now()`,
        })
        .where(eq(usersTable.stripeCustomerId, customerId));
      return;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db
        .update(usersTable)
        .set({
          plan: "free",
          stripeSubscriptionId: null,
          subscriptionStatus: "canceled",
          updatedAt: sql`now()`,
        })
        .where(eq(usersTable.stripeCustomerId, customerId));
      return;
    }

    default:
      logger.info({ eventType: event.type }, "Stripe: ignoring unhandled webhook event");
  }
}

function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
  const subAny = sub as unknown as { current_period_end?: number };
  if (typeof subAny.current_period_end === "number") {
    return new Date(subAny.current_period_end * 1000);
  }
  return null;
}

billingAuthedRouter.post("/billing/checkout", async (req, res, next) => {
  const stripe = getStripe();
  if (!stripe) {
    next(notConfigured());
    return;
  }
  const which = req.body?.priceId === "yearly" ? "yearly" : "monthly";
  const priceId = which === "yearly" ? PRICE_YEARLY : PRICE_MONTHLY;
  if (!priceId) {
    next(
      new ApiError(
        500,
        "BILLING_PRICE_NOT_CONFIGURED",
        `Stripe price for ${which} is not configured.`,
      ),
    );
    return;
  }

  try {
    const userId = userIdFrom(req);
    const customerId = await getOrCreateCustomerId(stripe, userId);
    const origin = originFor(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?status=cancelled`,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingAuthedRouter.post("/billing/portal", async (req, res, next) => {
  const stripe = getStripe();
  if (!stripe) {
    next(notConfigured());
    return;
  }
  try {
    const userId = userIdFrom(req);
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user?.stripeCustomerId) {
      next(ApiError.badRequest("No Stripe customer for this user — start a checkout first."));
      return;
    }
    const origin = originFor(req);
    const returnUrl = PORTAL_RETURN_URL.startsWith("http")
      ? PORTAL_RETURN_URL
      : `${origin}${PORTAL_RETURN_URL.startsWith("/") ? "" : "/"}${PORTAL_RETURN_URL}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });
    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

billingAuthedRouter.get("/billing/usage", async (req, res, next) => {
  try {
    const userId = userIdFrom(req);
    const usage = await getPlanUsage(userId);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

