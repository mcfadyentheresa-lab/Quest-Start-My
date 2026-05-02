import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, progressLogsTable } from "@workspace/db";
import {
  ListProgressLogsQueryParams,
  ListProgressLogsResponse,
} from "@workspace/api-zod";
import { asyncHandler } from "../lib/async-handler";
import { getUserId } from "../lib/auth";

const router: IRouter = Router();

router.get("/progress", asyncHandler(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const query = ListProgressLogsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 30;

  const logs = await db.select().from(progressLogsTable)
    .where(eq(progressLogsTable.userId, userId))
    .orderBy(desc(progressLogsTable.loggedAt))
    .limit(limit);

  res.json(ListProgressLogsResponse.parse(logs.map(l => ({
    ...l,
    loggedAt: l.loggedAt.toISOString(),
  }))));
}));

export default router;
