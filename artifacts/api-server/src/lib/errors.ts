import type { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "./logger";

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toEnvelope(): ApiErrorEnvelope {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: this.code,
        message: this.message,
      },
    };
    if (this.details !== undefined) {
      envelope.error.details = this.details;
    }
    return envelope;
  }

  static badRequest(message = "Bad Request", details?: unknown): ApiError {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Unauthorized", details?: unknown): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message, details);
  }

  static forbidden(message = "Forbidden", details?: unknown): ApiError {
    return new ApiError(403, "FORBIDDEN", message, details);
  }

  static notFound(message = "Not Found", details?: unknown): ApiError {
    return new ApiError(404, "NOT_FOUND", message, details);
  }

  static conflict(message = "Conflict", details?: unknown): ApiError {
    return new ApiError(409, "CONFLICT", message, details);
  }

  static unprocessable(
    message = "Unprocessable Entity",
    details?: unknown,
  ): ApiError {
    return new ApiError(422, "UNPROCESSABLE_ENTITY", message, details);
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json(ApiError.notFound(`Route ${req.method} ${req.path} not found`).toEnvelope());
};

// Postgres error codes we want to translate into clearer user-facing messages.
// See https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNDEFINED_TABLE = "42P01";
const PG_UNDEFINED_COLUMN = "42703";

interface PgLikeError {
  code?: string;
  message?: string;
  detail?: string;
  table?: string;
  column?: string;
}

function isPgError(err: unknown): err is PgLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toEnvelope());
    return;
  }

  // Surface schema/migration mismatches with an actionable message instead
  // of a bare 500. These almost always mean a migration has not been applied
  // on the deployed database (e.g. the pillars→areas rename).
  if (isPgError(err) && (err.code === PG_UNDEFINED_TABLE || err.code === PG_UNDEFINED_COLUMN)) {
    logger.error(
      {
        err,
        url: req.url,
        method: req.method,
        pgCode: err.code,
        pgTable: err.table,
        pgColumn: err.column,
      },
      "Database schema mismatch — migration likely not applied",
    );
    const apiError = new ApiError(
      503,
      "DATABASE_SCHEMA_MISMATCH",
      "The database is missing a required table or column. Run pending migrations and try again.",
      { pgCode: err.code, hint: err.message },
    );
    res.status(apiError.status).json(apiError.toEnvelope());
    return;
  }

  // ZodError on a response means our generated response schema is
  // out-of-sync with what the DB / application actually produces.
  // Return a 500 with the offending issues so we can diagnose without
  // needing log access (production logs are not always reachable).
  // The path tells us exactly which field failed validation.
  const errName =
    err instanceof Error ? err.name : typeof err === "object" && err !== null && "name" in err && typeof (err as { name: unknown }).name === "string"
      ? (err as { name: string }).name
      : "UnknownError";
  if (errName === "ZodError") {
    const issues = (err as { issues?: unknown }).issues;
    logger.error(
      { err, url: req.url, method: req.method, issues },
      "Response validation failed (ZodError) — generated schema is out of sync with runtime data",
    );
    const apiError = new ApiError(
      500,
      "RESPONSE_VALIDATION_FAILED",
      "The server produced data that didn't match its declared response schema.",
      { issues },
    );
    res.status(apiError.status).json(apiError.toEnvelope());
    return;
  }

  // Generic Postgres errors that aren't schema mismatches (connection,
  // permission, etc.) — surface the pg code so we can diagnose.
  if (isPgError(err)) {
    logger.error(
      {
        err,
        url: req.url,
        method: req.method,
        pgCode: err.code,
      },
      "Database error",
    );
    const apiError = new ApiError(
      500,
      "DATABASE_ERROR",
      "A database error occurred.",
      { pgCode: err.code },
    );
    res.status(apiError.status).json(apiError.toEnvelope());
    return;
  }

  logger.error(
    { err, url: req.url, method: req.method, errName },
    "Unhandled error",
  );
  // Include the error message (truncated, PII-redacted) and the constructor
  // name. Messages from drivers/runtimes (pg, drizzle, node:net) are safe to
  // surface — they describe failures like "Connection terminated unexpectedly"
  // or "relation X does not exist". User input never appears in error messages
  // because all req.body parsing goes through Zod which produces ZodError
  // (handled above).
  const rawMsg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string"
    ? (err as { message: string }).message
    : String(err);
  const sanitizedMsg = rawMsg
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "<DATABASE_URL>")
    .replace(/[A-Za-z0-9+/=]{32,}/g, "<TOKEN>")
    .slice(0, 500);
  const fallback = new ApiError(
    500,
    "INTERNAL_SERVER_ERROR",
    "Internal Server Error",
    { errName, message: sanitizedMsg },
  );
  res.status(fallback.status).json(fallback.toEnvelope());
};
