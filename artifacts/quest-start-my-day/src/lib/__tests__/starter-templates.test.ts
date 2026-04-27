import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES, getStarterTemplate } from "../starter-templates";

describe("Phase 5: starter templates (frontend)", () => {
  it("exposes the four templates the wizard renders", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id).sort()).toEqual([
      "balanced-life",
      "creative-practice",
      "solo-founder",
      "student",
    ]);
  });

  it("each pillar has a name + valid hex color", () => {
    for (const tpl of STARTER_TEMPLATES) {
      for (const p of tpl.pillars) {
        expect(p.name.trim().length).toBeGreaterThan(0);
        expect(p.color).toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it("getStarterTemplate roundtrips known ids and returns undefined for unknown ones", () => {
    expect(getStarterTemplate("solo-founder")?.name).toBe("Solo Founder");
    expect(getStarterTemplate("nonsense")).toBeUndefined();
  });
});
