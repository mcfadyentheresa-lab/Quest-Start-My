import { Router, type IRouter } from "express";
import {
  generateBriefing,
  approveBriefingForToday,
} from "../lib/briefing";

const router: IRouter = Router();

function getUserId(req: { userId?: string | null } & object): string | null {
  const candidate = (req as { userId?: string | null }).userId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

router.post("/briefing/today", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const briefing = await generateBriefing({ userId });
    res.json(briefing);
  } catch (err) {
    next(err);
  }
});

router.post("/briefing/reshuffle", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const hintRaw = (req.body && typeof req.body === "object" && "hint" in req.body)
      ? (req.body as Record<string, unknown>).hint
      : undefined;
    const hint = typeof hintRaw === "string" && hintRaw.trim().length > 0
      ? hintRaw.trim().slice(0, 200)
      : "Give me different suggestions for today.";
    const briefing = await generateBriefing({ userId, hint, bypassCache: true });
    res.json(briefing);
  } catch (err) {
    next(err);
  }
});

router.post("/briefing/approve", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const briefing = await approveBriefingForToday(userId);
    res.json({ ok: briefing !== null, briefing });
  } catch (err) {
    next(err);
  }
});

export default router;
