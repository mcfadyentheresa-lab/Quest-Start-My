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

  logger.error(
    { err, url: req.url, method: req.method },
    "Unhandled error",
  );
  const fallback = new ApiError(500, "INTERNAL_SERVER_ERROR", "Internal Server Error");
  res.status(fallback.status).json(fallback.toEnvelope());
};
