import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, progressLogsTable } from "@workspace/db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  DeleteTaskParams,
  ListTasksQueryParams,
  ListTasksResponse,
  UpdateTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const query = ListTasksQueryParams.safeParse(req.query);
  const today = new Date().toISOString().slice(0, 10);
  const date = query.success && query.data.date ? query.data.date : today;

  const tasks = await db.select().from(tasksTable)
    .where(eq(tasksTable.date, date))
    .orderBy(tasksTable.createdAt);

  res.json(ListTasksResponse.parse(tasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    title: parsed.data.title,
    category: parsed.data.category,
    whyItMatters: parsed.data.whyItMatters ?? null,
    doneLooksLike: parsed.data.doneLooksLike ?? null,
    suggestedNextStep: parsed.data.suggestedNextStep ?? null,
    pillarId: parsed.data.pillarId ?? null,
    milestoneId: parsed.data.milestoneId ?? null,
    blockerReason: parsed.data.blockerReason ?? null,
    date: parsed.data.date,
    status: "pending",
  }).returning();

  res.status(201).json({
    ...task,
    createdAt: task.createdAt.toISOString(),
  });
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.whyItMatters !== undefined) updates.whyItMatters = parsed.data.whyItMatters;
  if (parsed.data.doneLooksLike !== undefined) updates.doneLooksLike = parsed.data.doneLooksLike;
  if (parsed.data.suggestedNextStep !== undefined) updates.suggestedNextStep = parsed.data.suggestedNextStep;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.pillarId !== undefined) updates.pillarId = parsed.data.pillarId;
  if (parsed.data.milestoneId !== undefined) updates.milestoneId = parsed.data.milestoneId;
  if (parsed.data.blockerReason !== undefined) updates.blockerReason = parsed.data.blockerReason;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (parsed.data.status && parsed.data.status !== "pending") {
    await db.insert(progressLogsTable).values({
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      status: task.status,
      date: task.date,
    });
  }

  res.json(UpdateTaskResponse.parse({
    ...task,
    createdAt: task.createdAt.toISOString(),
  }));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
