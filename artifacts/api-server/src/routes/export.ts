import { Router, type IRouter } from "express";
import { db, pillarsTable, milestonesTable, tasksTable } from "@workspace/db";
import { scoped, userIdFrom } from "../lib/scoped";
import { getUserToday } from "../lib/time";
import { assertCanExport } from "../lib/plan";

const router: IRouter = Router();

type PillarRow = typeof pillarsTable.$inferSelect;
type MilestoneRow = typeof milestonesTable.$inferSelect;
type TaskRow = typeof tasksTable.$inferSelect;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(values: ReadonlyArray<unknown>): string {
  return values.map(csvEscape).join(",");
}

export const EXPORT_CSV_HEADER = row([
  "kind",
  "id",
  "title",
  "status",
  "category",
  "date",
  "pillarId",
  "pillarName",
  "milestoneId",
  "milestoneTitle",
  "description",
  "createdAt",
]);

export function buildExportCsv(
  pillars: ReadonlyArray<PillarRow>,
  milestones: ReadonlyArray<MilestoneRow>,
  tasks: ReadonlyArray<TaskRow>,
): string {
  const pillarsById = new Map(pillars.map((p) => [p.id, p]));
  const milestonesById = new Map(milestones.map((m) => [m.id, m]));

  const lines: string[] = [EXPORT_CSV_HEADER];

  for (const p of pillars) {
    lines.push(
      row([
        "pillar",
        p.id,
        p.name,
        p.portfolioStatus ?? "",
        p.category ?? "",
        "",
        p.id,
        p.name,
        "",
        "",
        p.description ?? "",
        p.createdAt.toISOString(),
      ]),
    );
  }

  for (const m of milestones) {
    const pillar = pillarsById.get(m.pillarId);
    lines.push(
      row([
        "milestone",
        m.id,
        m.title,
        m.status,
        "",
        m.targetDate ?? "",
        m.pillarId,
        pillar?.name ?? "",
        m.id,
        m.title,
        m.description ?? "",
        m.createdAt.toISOString(),
      ]),
    );
  }

  for (const t of tasks) {
    const pillar = t.pillarId !== null ? pillarsById.get(t.pillarId) : undefined;
    const milestone = t.milestoneId !== null ? milestonesById.get(t.milestoneId) : undefined;
    lines.push(
      row([
        "task",
        t.id,
        t.title,
        t.status,
        t.category,
        t.date,
        t.pillarId ?? "",
        pillar?.name ?? "",
        t.milestoneId ?? "",
        milestone?.title ?? "",
        t.whyItMatters ?? "",
        t.createdAt.toISOString(),
      ]),
    );
  }

  return lines.join("\n") + "\n";
}

export function exportFilename(today: string): string {
  return `quest-export-${today}.csv`;
}

router.get("/export.csv", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  await assertCanExport(userId);
  const s = scoped(userId);

  const [pillars, milestones, tasks] = await Promise.all([
    db.select().from(pillarsTable).where(s.pillars.owns).orderBy(pillarsTable.id),
    db.select().from(milestonesTable).where(s.milestones.owns).orderBy(milestonesTable.id),
    db.select().from(tasksTable).where(s.tasks.owns).orderBy(tasksTable.id),
  ]);

  const csv = buildExportCsv(pillars, milestones, tasks);
  const today = getUserToday(req.userTimezone);
  const filename = exportFilename(today);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
});

export default router;
