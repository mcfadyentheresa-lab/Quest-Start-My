import type { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "node:crypto";
import { ApiError } from "./errors";
import { logger } from "./logger";

/**
 * Single-owner shared-secret auth.
 *
 * Quest is currently a single-tenant personal app deployed at a public URL.
 * Multi-user signup is intentionally out of scope (see audit BLOCK-1). To
 * stop the data leak immediately, we require a shared secret on every
 * /api/* request and resolve every authenticated request to one owner user
 * id. The schema and route layer are already scoped by user_id, so swapping
 * this middleware for real session auth later requires zero route changes.
 *
 * Required env:
 *   QUEST_AUTH_TOKEN     — shared secret. If unset in production, /api/*
 *                          (other than the bypass list) will reject every
 *                          request with 503 SERVER_NOT_CONFIGURED.
 *   QUEST_OWNER_USER_ID  — owner identifier (default "owner"). All existing
 *                          rows are backfilled to this value.
 *   COOKIE_SECURE        — "false" to disable Secure flag for local http
 *                          development. Defaults to true in production.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const SESSION_COOKIE = "quest_session";

/**
 * Path prefixes that bypass auth entirely. Match against both the
 * mount-relative path (e.g. "/healthz" when mounted at "/api") and the
 * full original URL ("/api/healthz") for safety.
 */
const BYPASS_PREFIXES = [
  "/healthz",
  "/auth/",
  "/api/healthz",
  "/api/auth/",
];

function getOwnerUserId(): string {
  const raw = process.env["QUEST_OWNER_USER_ID"];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "owner";
}

function getAuthToken(): string | null {
  const raw = process.env["QUEST_AUTH_TOKEN"];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function presentedToken(req: Request): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE];
  if (cookieToken) return cookieToken;

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

/**
 * Mounts BEFORE the API router. Bypasses health + auth subroutes; rejects
 * every other /api/* request that does not present the shared secret.
 *
 * Sets req.userId on success.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  // req.path is mount-relative ("/healthz" when mounted at "/api"). originalUrl
  // is absolute ("/api/healthz?foo=1"). Strip the query string for matching.
  const candidates = [req.path, (req.originalUrl || "").split("?")[0] ?? ""];
  for (const p of candidates) {
    for (const prefix of BYPASS_PREFIXES) {
      if (p === prefix || p === prefix.replace(/\/$/, "") || p.startsWith(prefix)) {
        return next();
      }
    }
  }

  const expected = getAuthToken();
  if (!expected) {
    logger.error(
      "QUEST_AUTH_TOKEN is not set — refusing all authenticated requests",
    );
    return next(
      new ApiError(
        503,
        "SERVER_NOT_CONFIGURED",
        "Authentication is not configured on this server.",
      ),
    );
  }

  const presented = presentedToken(req);
  if (!presented || !constantTimeEqual(presented, expected)) {
    return next(ApiError.unauthorized("Sign in required."));
  }

  req.userId = getOwnerUserId();
  next();
};

/** Reads req.userId set by requireAuth. Throws 401 if missing. */
export function getUserId(req: Request): string {
  const id = req.userId;
  if (typeof id !== "string" || id.length === 0) {
    throw ApiError.unauthorized("Sign in required.");
  }
  return id;
}

/**
 * /api/auth/* router. Provides:
 *   POST /api/auth/sign-in   { token } -> 204, sets session cookie
 *   POST /api/auth/sign-out  -> 204, clears session cookie
 *   GET  /api/auth/me        -> { userId } when signed in, 401 otherwise
 *
 * Mounted via the main API router so it shares helmet/rate-limit, but it is
 * exempt from `requireAuth` via the bypass list above.
 */
export function buildAuthRouter(): import("express").IRouter {
  // Imported lazily here so this module can be loaded by tests that don't
  // construct an Express app.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Router } = require("express") as typeof import("express");
  const router = Router();

  router.post("/auth/sign-in", (req, res, next) => {
    try {
      const expected = getAuthToken();
      if (!expected) {
        throw new ApiError(
          503,
          "SERVER_NOT_CONFIGURED",
          "Authentication is not configured on this server.",
        );
      }
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
        token?: unknown;
      };
      const presented = typeof body.token === "string" ? body.token : "";
      if (!presented || !constantTimeEqual(presented, expected)) {
        // Small delay to slow brute-force; not a substitute for rate limit.
        setTimeout(() => {
          next(ApiError.unauthorized("Incorrect token."));
        }, 250);
        return;
      }

      const cookieSecure = process.env["COOKIE_SECURE"] !== "false";
      const parts = [
        `${SESSION_COOKIE}=${encodeURIComponent(expected)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        // 30 days. Token is the only credential, so re-prompting more often
        // would be the right tradeoff once real sessions land.
        `Max-Age=${60 * 60 * 24 * 30}`,
      ];
      if (cookieSecure) parts.push("Secure");
      res.setHeader("Set-Cookie", parts.join("; "));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post("/auth/sign-out", (_req, res) => {
    const cookieSecure = process.env["COOKIE_SECURE"] !== "false";
    const parts = [
      `${SESSION_COOKIE}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
    ];
    if (cookieSecure) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
    res.status(204).end();
  });

  router.get("/auth/me", (req: Request, _res: Response, next: NextFunction) => {
    // requireAuth already populated req.userId for everything except the
    // bypass list. This route is on the bypass list so we must validate
    // ourselves.
    const expected = getAuthToken();
    if (!expected) {
      return next(
        new ApiError(
          503,
          "SERVER_NOT_CONFIGURED",
          "Authentication is not configured on this server.",
        ),
      );
    }
    const presented = presentedToken(req);
    if (!presented || !constantTimeEqual(presented, expected)) {
      return next(ApiError.unauthorized("Sign in required."));
    }
    _res.json({ userId: getOwnerUserId() });
  });

  return router;
}
