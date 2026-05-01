import { describe, expect, it } from "vitest";
import { buildUserPrompt, fallbackSteps, SYSTEM_PROMPT } from "../ai";

describe("buildUserPrompt", () => {
  it("includes goal title, description, area context, existing steps, recent activity, and today's date", () => {
    const prompt = buildUserPrompt({
      goalTitle: "Launch the Aster site rebuild",
      goalDescription: "Three pages: home, about, contact. Sara owns copy.",
      areaName: "Aster",
      areaDescription: "Client work",
      areaPriority: "P1",
      areaActiveThisWeek: true,
      existingStepTitles: ["Pick a font", "Confirm budget"],
      recentlyCompletedTitles: ["Sent kickoff email", "Booked photographer"],
      todayIso: "2026-05-01",
    });

    expect(prompt).toContain("Launch the Aster site rebuild");
    expect(prompt).toContain("Three pages: home, about, contact");
    expect(prompt).toContain("Aster");
    expect(prompt).toContain("Client work");
    expect(prompt).toContain("P1");
    expect(prompt).toContain("active this week");
    expect(prompt).toContain("Pick a font");
    expect(prompt).toContain("Confirm budget");
    expect(prompt).toContain("do NOT duplicate");
    expect(prompt).toContain("Sent kickoff email");
    expect(prompt).toContain("Booked photographer");
    expect(prompt).toContain("2026-05-01");
    // Few-shot anchor must be present.
    expect(prompt).toContain("Move out of the apartment");
  });

  it("omits empty optional sections cleanly", () => {
    const prompt = buildUserPrompt({
      goalTitle: "Plan the offsite",
      goalDescription: null,
      areaName: null,
      areaDescription: null,
      areaPriority: null,
      areaActiveThisWeek: null,
      existingStepTitles: [],
      recentlyCompletedTitles: [],
      todayIso: "2026-05-01",
    });

    // Slice off the few-shot example so we only assert against the user's
    // own goal context.
    const userSection = prompt.split("Now do the same for this goal.")[1] ?? "";
    expect(userSection).toContain("Plan the offsite");
    expect(userSection).not.toContain("Pillar:");
    expect(userSection).not.toContain("Existing steps");
    expect(userSection).not.toContain("Recently completed");
  });

  it("flags an inactive pillar instead of dropping the flag", () => {
    const prompt = buildUserPrompt({
      goalTitle: "Outline next quarter",
      goalDescription: null,
      areaName: "Strategy",
      areaDescription: null,
      areaPriority: "P2",
      areaActiveThisWeek: false,
      existingStepTitles: [],
      recentlyCompletedTitles: [],
      todayIso: "2026-05-01",
    });
    expect(prompt).toContain("not active this week");
    expect(prompt).toContain("P2");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("encodes the chief-of-staff voice and specificity rules", () => {
    expect(SYSTEM_PROMPT).toContain("chief of staff");
    expect(SYSTEM_PROMPT).toMatch(/3 and 10/);
    expect(SYSTEM_PROMPT).toContain("Specific");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("no filler");
  });
});

describe("fallbackSteps", () => {
  it("references the goal title in the deterministic plan", () => {
    const steps = fallbackSteps({ goalTitle: "Refresh the deck", areaName: "Sales" });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.every((s) => s.includes("Refresh the deck"))).toBe(true);
    expect(steps.some((s) => s.includes("Sales"))).toBe(true);
  });

  it("works without an area name", () => {
    const steps = fallbackSteps({ goalTitle: "Refresh the deck" });
    expect(steps.every((s) => s.includes("Refresh the deck"))).toBe(true);
  });
});
