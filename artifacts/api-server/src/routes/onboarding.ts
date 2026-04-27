import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, usersTable, pillarsTable, milestonesTable } from "@workspace/db";
import { scoped, userIdFrom } from "../lib/scoped";
import { getStarterTemplate, type StarterPillar } from "../lib/starter-templates";

const router: IRouter = Router();

const CustomPillar = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  portfolioStatus: z.enum(["Active", "Warm", "Dormant"]).optional(),
});

const CompleteOnboardingBody = z.object({
  templateId: z.string().min(1).optional(),
  customPillars: z.array(CustomPillar).optional(),
});

router.get("/me", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const [row] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      timezone: usersTable.timezone,
      onboardedAt: usersTable.onboardedAt,
      dismissedChecklist: usersTable.dismissedChecklist,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: row.id,
    email: row.email,
    name: row.name,
    timezone: row.timezone,
    onboardedAt: row.onboardedAt ? row.onboardedAt.toISOString() : null,
    dismissedChecklist: row.dismissedChecklist ? row.dismissedChecklist.toISOString() : null,
  });
});

router.post("/onboarding/complete", async (req, res): Promise<void> => {
  const parsed = CompleteOnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = userIdFrom(req);
  const s = scoped(userId);

  // Idempotency: if already onboarded, return current state without changes.
  const [existing] = await db
    .select({ onboardedAt: usersTable.onboardedAt })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (existing?.onboardedAt) {
    res.json({
      onboardedAt: existing.onboardedAt.toISOString(),
      pillarsCreated: 0,
      alreadyOnboarded: true,
    });
    return;
  }

  // Resolve which pillars to create.
  let pillarsToCreate: StarterPillar[] = [];
  if (parsed.data.templateId) {
    const tpl = getStarterTemplate(parsed.data.templateId);
    if (!tpl) {
      res.status(400).json({ error: `Unknown templateId: ${parsed.data.templateId}` });
      return;
    }
    pillarsToCreate = tpl.pillars;
  } else if (parsed.data.customPillars && parsed.data.customPillars.length > 0) {
    pillarsToCreate = parsed.data.customPillars.map((p) => ({
      name: p.name,
      color: p.color ?? "#3b82f6",
      portfolioStatus: p.portfolioStatus ?? "Active",
    }));
  }

  let pillarsCreated = 0;

  for (const p of pillarsToCreate) {
    const [pillar] = await db
      .insert(pillarsTable)
      .values(
        s.pillars.withUser({
          name: p.name,
          color: p.color,
          portfolioStatus: p.portfolioStatus,
        }),
      )
      .onConflictDoNothing({ target: [pillarsTable.userId, pillarsTable.name] })
      .returning();

    if (pillar) {
      pillarsCreated++;
      const milestones = p.milestones ?? [];
      if (milestones.length > 0) {
        await db.insert(milestonesTable).values(
          milestones.map((m, idx) => ({
            userId,
            pillarId: pillar.id,
            title: m.title,
            description: m.description ?? null,
            sortOrder: idx,
          })),
        );
      }
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({ onboardedAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(usersTable.id, userId))
    .returning({ onboardedAt: usersTable.onboardedAt });

  res.json({
    onboardedAt: updated?.onboardedAt ? updated.onboardedAt.toISOString() : null,
    pillarsCreated,
    alreadyOnboarded: false,
  });
});

router.post("/onboarding/dismiss-checklist", async (req, res): Promise<void> => {
  const userId = userIdFrom(req);
  const [updated] = await db
    .update(usersTable)
    .set({ dismissedChecklist: sql`now()`, updatedAt: sql`now()` })
    .where(eq(usersTable.id, userId))
    .returning({ dismissedChecklist: usersTable.dismissedChecklist });

  res.json({
    dismissedChecklist: updated?.dismissedChecklist
      ? updated.dismissedChecklist.toISOString()
      : null,
  });
});

export default router;
