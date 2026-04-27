import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, progressLogsTable } from "@workspace/db";
import {
  ListProgressLogsQueryParams,
  ListProgressLogsResponse,
} from "@workspace/api-zod";
import { scoped, userIdFrom } from "../lib/scoped";

const router: IRouter = Router();

router.get("/progress", async (req, res): Promise<void> => {
  const s = scoped(userIdFrom(req));
  const query = ListProgressLogsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 30;

  const logs = await db.select().from(progressLogsTable)
    .where(s.progressLogs.owns)
    .orderBy(desc(progressLogsTable.loggedAt))
    .limit(limit);

  res.json(ListProgressLogsResponse.parse(logs.map(l => ({
    ...l,
    loggedAt: l.loggedAt.toISOString(),
  }))));
});

export default router;
