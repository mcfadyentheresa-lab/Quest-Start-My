import { afterEach, describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  buildBreakdownSteps,
  fallbackSteps,
  setBreakdownChatClient,
  SYSTEM_PROMPT,
  type BreakdownContext,
} from "../ai";

const baseCtx: BreakdownContext = {
  goalTitle: "Launch the Aster onboarding flow",
  goalDescription: "Three-screen guided sign-up plus first-run checklist.",
  areaName: "Aster & Spruce Living",
  areaDescription: "Productized retreat brand.",
  areaPriority: "P1",
  areaIsActiveThisWeek: true,
  existingStepTitles: [],
  recentCompletedTitle: "Wired the magic-link auth handoff.",
};

describe("buildUserPrompt", () => {
  it("includes goal title, description, area + priority + activity, and recent completed", () => {
    const out = buildUserPrompt(baseCtx);
    expect(out).toContain("Goal: Launch the Aster onboarding flow");
    expect(out).toContain("Description: Three-screen guided sign-up plus first-run checklist.");
    expect(out).toContain("Area: Aster & Spruce Living (P1, Active this week)");
    expect(out).toContain("Area context: Productized retreat brand.");
    expect(out).toContain("Most recent completed work in this area: Wired the magic-link auth handoff.");
    expect(out).toContain("Existing steps: none.");
  });

  it("lists existing steps so the model does not duplicate", () => {
    const out = buildUserPrompt({
      ...baseCtx,
      existingStepTitles: ["Pick the welcome copy.", "Wire the form to the API."],
    });
    expect(out).toContain("Existing steps (do NOT repeat):");
    expect(out).toContain("- Pick the welcome copy.");
    expect(out).toContain("- Wire the form to the API.");
    expect(out).not.toContain("Existing steps: none.");
  });

  it("omits area block when no area name is provided", () => {
    const out = buildUserPrompt({
      ...baseCtx,
      areaName: null,
      areaDescription: null,
      areaPriority: null,
      areaIsActiveThisWeek: null,
    });
    expect(out).not.toContain("Area:");
    expect(out).not.toContain("Area context:");
  });

  it("renders 'Not active this week' when area is inactive", () => {
    const out = buildUserPrompt({ ...baseCtx, areaIsActiveThisWeek: false });
    expect(out).toContain("Not active this week");
  });

  it("ends with the strict-JSON instruction", () => {
    expect(buildUserPrompt(baseCtx).trimEnd()).toMatch(
      /Return JSON only: \{ "steps": \["\.\.\.", "\.\.\."\] \}\. 3 to 10 specific, ordered steps\.$/,
    );
  });
});

describe("SYSTEM_PROMPT", () => {
  it("forbids generic placeholders and pins the JSON shape", () => {
    expect(SYSTEM_PROMPT).toContain('"steps":');
    expect(SYSTEM_PROMPT).toMatch(/Plan it/);
    expect(SYSTEM_PROMPT).toMatch(/3 to 10/);
    expect(SYSTEM_PROMPT).toMatch(/no "I" or "me"/);
  });

  it("contains a concrete few-shot example", () => {
    expect(SYSTEM_PROMPT).toContain("Move into the new apartment");
    expect(SYSTEM_PROMPT).toContain('"steps": [');
  });
});

describe("fallbackSteps", () => {
  it("returns three concrete steps — never the old Plan/Do/Review trio", () => {
    const steps = fallbackSteps();
    expect(steps).toEqual([
      "Outline scope.",
      "Block first focus session.",
      "Capture open questions.",
    ]);
    expect(steps.some((s) => /^Plan/i.test(s))).toBe(false);
  });
});

describe("buildBreakdownSteps", () => {
  afterEach(() => {
    setBreakdownChatClient(null);
  });

  it("passes the constructed system + user prompt to the chat client", async () => {
    const captured: { systemPrompt: string; userPrompt: string; apiKey: string }[] = [];
    setBreakdownChatClient(async ({ systemPrompt, userPrompt, apiKey }) => {
      captured.push({ systemPrompt, userPrompt, apiKey });
      return JSON.stringify({ steps: ["A.", "B.", "C.", "D."] });
    });

    const result = await buildBreakdownSteps(baseCtx, { apiKey: "test", timeoutMs: 1000 });

    expect(result).toEqual(["A.", "B.", "C.", "D."]);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.systemPrompt).toBe(SYSTEM_PROMPT);
    expect(captured[0]!.userPrompt).toContain("Goal: Launch the Aster onboarding flow");
    expect(captured[0]!.apiKey).toBe("test");
  });

  it("rejects responses with fewer than three steps", async () => {
    setBreakdownChatClient(async () => JSON.stringify({ steps: ["only one."] }));
    await expect(
      buildBreakdownSteps(baseCtx, { apiKey: "test", timeoutMs: 1000 }),
    ).rejects.toThrow(/too few steps/);
  });
});
