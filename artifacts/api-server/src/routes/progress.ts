import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, progressLogsTable } from "@workspace/db";
import {
  ListProgressLogsQueryParams,
  ListProgressLogsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/progress", async (req, res): Promise<void> => {
  const query = ListProgressLogsQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 30;

  const logs = await db.select().from(progressLogsTable)
    .orderBy(desc(progressLogsTable.loggedAt))
    .limit(limit);

  res.json(ListProgressLogsResponse.parse(logs.map(l => ({
    ...l,
    loggedAt: l.loggedAt.toISOString(),
  }))));
});

export default router;
