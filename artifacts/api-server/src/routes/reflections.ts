import { Router, type IRouter } from "express";
import { generateReflectionDraft } from "../lib/reflections-draft";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

function getUserId(req: { userId?: string | null } & object): string | null {
  const candidate = (req as { userId?: string | null }).userId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function getWeekStart(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getMonthOf(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

router.post("/reflections/weekly/draft", asyncHandler(async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const weekOfRaw = typeof body.weekOf === "string" ? body.weekOf : "";
    const weekOf = WEEK_RE.test(weekOfRaw) ? weekOfRaw : getWeekStart();
    const bypassCache = body.bypassCache === true;

    const draft = await generateReflectionDraft({
      cadence: "week",
      periodKey: weekOf,
      userId: getUserId(req),
      bypassCache,
    });
    res.json(draft);
  } catch (err) {
    next(err);
  }
}));

router.post("/reflections/monthly/draft", asyncHandler(async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const monthOfRaw = typeof body.monthOf === "string" ? body.monthOf : "";
    const monthOf = MONTH_RE.test(monthOfRaw) ? monthOfRaw : getMonthOf();
    const bypassCache = body.bypassCache === true;

    const draft = await generateReflectionDraft({
      cadence: "month",
      periodKey: monthOf,
      userId: getUserId(req),
      bypassCache,
    });
    res.json(draft);
  } catch (err) {
    next(err);
  }
}));

export default router;
