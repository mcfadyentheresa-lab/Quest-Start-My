// Universal Capture endpoint.
//
// One write path for "I have an idea, take it." Behavior:
//   - text shorter than AI_CLEAN_THRESHOLD_CHARS → use verbatim, no AI.
//   - text longer → call cleanBrainDump (AI). On success store the
//     cleaned title + whyItMatters + doneLooksLike, set originalDump to
//     the verbatim text, set needsReview=true so the UI surfaces a
//     "Review draft" chip.
//   - AI failure or no API key → fall back to fallbackCleanBrainDump
//     (deterministic). Still store originalDump + needsReview=true.
//
// `when` is one of "today" | "later". "today" sets date to today's ISO
// (server local UTC date — mirrors what /tasks?date=today expects).
// "later" leaves date null (inbox).

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, areasTable } from "@workspace/db";
import { CreateCaptureBody } from "@workspace/api-zod";
import { getUserId } from "../lib/auth";
import { asyncHandler } from "../lib/async-handler";
import { logger } from "../lib/logger";
import { readOpenAiApiKey } from "../lib/openai-key";
import {
  AI_CLEAN_THRESHOLD_CHARS,
  cleanBrainDump,
  fallbackCleanBrainDump,
} from "../lib/capture/ai";

const router: IRouter = Router();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

router.post(
  "/capture",
  asyncHandler(async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const parsed = CreateCaptureBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const body = parsed.data;
    const text = body.text.trim();
    const when: "today" | "later" = body.when ?? "later";
    if (text.length === 0) {
      res.status(400).json({ error: "text is empty after trim" });
      return;
    }

    const apiKey = readOpenAiApiKey();

    // Look up area name for AI grounding (optional — only when areaId given).
    let areaName: string | null = null;
    let areaDescription: string | null = null;
    if (body.areaId != null) {
      const [area] = await db
        .select({ name: areasTable.name, description: areasTable.description })
        .from(areasTable)
        .where(eq(areasTable.id, body.areaId))
        .limit(1);
      if (area) {
        areaName = area.name;
        areaDescription = area.description;
      }
    }

    // Decide whether to invoke AI. Short text → verbatim.
    let title = text;
    let whyItMatters: string | null = null;
    let doneLooksLike: string | null = null;
    let originalDump: string | null = null;
    let needsReview = false;

    if (text.length >= AI_CLEAN_THRESHOLD_CHARS) {
      originalDump = text;
      needsReview = true;
      if (apiKey) {
        try {
          const cleaned = await cleanBrainDump(
            text,
            { areaName, areaDescription },
            apiKey,
          );
          title = cleaned.title;
          whyItMatters = cleaned.whyItMatters;
          doneLooksLike = cleaned.doneLooksLike;
        } catch (err) {
          logger.warn(
            { err: (err as Error).message },
            "capture: AI cleaner failed, using deterministic fallback",
          );
          const fb = fallbackCleanBrainDump(text);
          title = fb.title;
          whyItMatters = fb.whyItMatters;
          doneLooksLike = fb.doneLooksLike;
        }
      } else {
        // No API key configured — deterministic fallback.
        const fb = fallbackCleanBrainDump(text);
        title = fb.title;
        whyItMatters = fb.whyItMatters;
        doneLooksLike = fb.doneLooksLike;
      }
    }

    const date = when === "today" ? todayIso() : null;

    const [task] = await db
      .insert(tasksTable)
      .values({
        userId,
        title,
        category: "business",
        whyItMatters,
        doneLooksLike,
        areaId: body.areaId ?? null,
        date,
        status: "pending",
        taskSource: "capture",
        originalDump,
        needsReview,
      })
      .returning();

    res.status(201).json({
      ...task,
      createdAt: task.createdAt.toISOString(),
    });
  }),
);

export default router;
