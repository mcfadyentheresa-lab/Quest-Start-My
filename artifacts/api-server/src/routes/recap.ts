import { Router, type IRouter } from "express";
import { generateRecap, saveRecapReflection } from "../lib/recap";

const router: IRouter = Router();

function getUserId(req: { userId?: string | null } & object): string | null {
  const candidate = (req as { userId?: string | null }).userId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

router.get("/dashboard/recap", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const recap = await generateRecap({ userId });
    res.json(recap);
  } catch (err) {
    next(err);
  }
});

router.post("/dashboard/recap/regenerate", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const recap = await generateRecap({ userId, bypassCache: true });
    res.json(recap);
  } catch (err) {
    next(err);
  }
});

router.post("/dashboard/recap/reflection", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const raw = body.reflection;
    const reflection = typeof raw === "string" ? raw : "";
    if (reflection.length > 1000) {
      res.status(400).json({ error: "Reflection too long (max 1000 chars)" });
      return;
    }
    const recap = await saveRecapReflection(userId, reflection);
    if (!recap) {
      res.status(404).json({ error: "No recap found for today — generate one first" });
      return;
    }
    res.json(recap);
  } catch (err) {
    next(err);
  }
});

export default router;
