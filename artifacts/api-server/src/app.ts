import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./lib/errors";
import { ensureOwnerUserExists } from "./middleware/auth";

// Owner mode: make sure the owner user row exists so foreign keys hold up
// even on a brand-new database. In Clerk mode this is a no-op; the user
// rows are auto-provisioned by requireAuth on first request.
ensureOwnerUserExists().catch((err) => {
  logger.error({ err }, "Failed to ensure owner user exists");
});

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

const corsOriginsRaw = process.env["CORS_ORIGINS"];
const corsOrigins = corsOriginsRaw
  ? corsOriginsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];
if (corsOrigins.length > 0) {
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );
}

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const rateLimitMax = Number(process.env["RATE_LIMIT_MAX"] ?? 300);
const rateLimitWindowMs = Number(process.env["RATE_LIMIT_WINDOW_MS"] ?? 900000);
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter, router);

// Optionally serve the built frontend from this server so the whole app runs
// as a single service (e.g. on Railway). Enable by setting STATIC_DIR to the
// absolute path of the built frontend (containing index.html).
const staticDir = process.env["STATIC_DIR"];
if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
  logger.info({ staticDir }, "Serving static frontend");
  app.use(express.static(staticDir));
  // SPA fallback — any non-/api route returns index.html so client-side
  // routing (wouter) can take over.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
} else if (staticDir) {
  logger.warn(
    { staticDir },
    "STATIC_DIR is set but index.html was not found; skipping static serving",
  );
} else {
  app.use(notFoundHandler);
}

app.use(errorHandler);

export default app;
