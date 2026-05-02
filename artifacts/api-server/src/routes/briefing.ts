import { Router, type IRouter } from "express";
import {
  generateBriefing,
  approveBriefingForToday,
} from "../lib/briefing";
import { asyncHandler } from "../lib/async-handler";
import { getUserId } from "../lib/auth";

const router: IRouter = Router();

router.post("/briefing/today", asyncHandler(async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const briefing = await generateBriefing({ userId });
    res.json(briefing);
  } catch (err) {
    next(err);
  }
}));

router.post("/briefing/reshuffle", asyncHandler(async (req, res, next) => {
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
}));

router.post("/briefing/approve", asyncHandler(async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const briefing = await approveBriefingForToday(userId);
    res.json({ ok: briefing !== null, briefing });
  } catch (err) {
    next(err);
  }
}));

export default router;
