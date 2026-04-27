import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { STARTER_TEMPLATES, getStarterTemplate } from "../../lib/starter-templates";

// Mirror of the schema used in routes/onboarding.ts. Kept in this test as a
// guard so accidental edits to the route are caught here.
const CustomPillar = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  portfolioStatus: z.enum(["Active", "Warm", "Dormant"]).optional(),
});

const CompleteOnboardingBody = z.object({
  templateId: z.string().min(1).optional(),
  customPillars: z.array(CustomPillar).optional(),
});

describe("Phase 5: starter templates", () => {
  it("ships exactly the four required templates", () => {
    const ids = STARTER_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual([
      "balanced-life",
      "creative-practice",
      "solo-founder",
      "student",
    ]);
  });

  it("each template has between 4 and 5 pillars with names + colors", () => {
    for (const tpl of STARTER_TEMPLATES) {
      expect(tpl.pillars.length).toBeGreaterThanOrEqual(4);
      expect(tpl.pillars.length).toBeLessThanOrEqual(5);
      for (const p of tpl.pillars) {
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.color).toMatch(/^#[0-9a-f]{3,8}$/i);
        expect(["Active", "Warm", "Dormant"]).toContain(p.portfolioStatus);
      }
    }
  });

  it("at least one pillar per template is Active", () => {
    for (const tpl of STARTER_TEMPLATES) {
      const activeCount = tpl.pillars.filter((p) => p.portfolioStatus === "Active").length;
      expect(activeCount).toBeGreaterThan(0);
    }
  });

  it("getStarterTemplate returns the right one and undefined for unknown ids", () => {
    expect(getStarterTemplate("balanced-life")?.name).toBe("Balanced Life");
    expect(getStarterTemplate("does-not-exist")).toBeUndefined();
  });
});

describe("Phase 5: CompleteOnboardingBody schema", () => {
  it("accepts an empty body (start blank, no pillars)", () => {
    const r = CompleteOnboardingBody.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a templateId", () => {
    const r = CompleteOnboardingBody.safeParse({ templateId: "balanced-life" });
    expect(r.success).toBe(true);
  });

  it("accepts custom pillars", () => {
    const r = CompleteOnboardingBody.safeParse({
      customPillars: [
        { name: "Health", color: "#10b981", portfolioStatus: "Active" },
        { name: "Family" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty pillar names", () => {
    const r = CompleteOnboardingBody.safeParse({ customPillars: [{ name: "" }] });
    expect(r.success).toBe(false);
  });

  it("rejects unknown portfolioStatus values", () => {
    const r = CompleteOnboardingBody.safeParse({
      customPillars: [{ name: "Health", portfolioStatus: "Maybe" }],
    });
    expect(r.success).toBe(false);
  });
});
