import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

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
}

export default app;
