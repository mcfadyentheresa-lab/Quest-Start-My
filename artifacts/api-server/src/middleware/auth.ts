import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { ApiError } from "../lib/errors";
import { logger } from "../lib/logger";

const OWNER_USER_ID = process.env["OWNER_USER_ID"] ?? "owner";
const OWNER_EMAIL = process.env["OWNER_EMAIL"] ?? "info@asterandspruceliving.ca";
const CLERK_SECRET = process.env["CLERK_SECRET_KEY"];

let bootLogged = false;
function logModeOnce() {
  if (bootLogged) return;
  bootLogged = true;
  if (CLERK_SECRET) {
    logger.info("Auth: Clerk mode enabled (CLERK_SECRET_KEY present)");
  } else {
    logger.warn(
      { ownerUserId: OWNER_USER_ID },
      "Auth: owner mode (CLERK_SECRET_KEY missing) — all requests scoped to owner user",
    );
  }
}

interface ClerkVerifyResult {
  userId: string;
  email: string | null;
}

let cachedVerifier: ((token: string) => Promise<ClerkVerifyResult>) | null = null;

async function getClerkVerifier(): Promise<(token: string) => Promise<ClerkVerifyResult>> {
  if (cachedVerifier) return cachedVerifier;

  // Dynamic import so the SDK is only loaded when Clerk mode is active.
  const clerk = await import("@clerk/express");
  const { verifyToken, createClerkClient } = clerk;
  const clerkClient = createClerkClient({ secretKey: CLERK_SECRET! });

  cachedVerifier = async (token: string): Promise<ClerkVerifyResult> => {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET! });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) throw ApiError.unauthorized("Invalid Clerk token: missing sub");

    let email: string | null = null;
    try {
      const user = await clerkClient.users.getUser(userId);
      email = user.primaryEmailAddress?.emailAddress
        ?? user.emailAddresses[0]?.emailAddress
        ?? null;
    } catch {
      email = null;
    }
    return { userId, email };
  };

  return cachedVerifier;
}

async function ensureUserRow(userId: string, email: string | null): Promise<void> {
  // Upsert: insert if missing, otherwise leave the row alone (don't clobber
  // an existing email/name with a possibly-stale value from token refresh).
  await db
    .insert(usersTable)
    .values({
      id: userId,
      email: email ?? `${userId}@unknown.local`,
      name: null,
    })
    .onConflictDoNothing({ target: usersTable.id });

  // If the user existed but had a placeholder email, update it once we
  // discover the real one.
  if (email) {
    await db
      .update(usersTable)
      .set({ email, updatedAt: sql`now()` })
      .where(eq(usersTable.id, userId));
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  logModeOnce();

  if (!CLERK_SECRET) {
    req.userId = OWNER_USER_ID;
    req.userEmail = OWNER_EMAIL;
    next();
    return;
  }

  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    next(ApiError.unauthorized("Missing bearer token"));
    return;
  }
  const token = header.slice(7).trim();
  if (!token) {
    next(ApiError.unauthorized("Empty bearer token"));
    return;
  }

  try {
    const verify = await getClerkVerifier();
    const { userId, email } = await verify(token);
    await ensureUserRow(userId, email);
    req.userId = userId;
    if (email) req.userEmail = email;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}

export function isClerkMode(): boolean {
  return Boolean(CLERK_SECRET);
}

export function getOwnerUserId(): string {
  return OWNER_USER_ID;
}

export async function ensureOwnerUserExists(): Promise<void> {
  if (CLERK_SECRET) return;
  await db
    .insert(usersTable)
    .values({
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      name: "Theresa McFadyen",
    })
    .onConflictDoNothing({ target: usersTable.id });
}
