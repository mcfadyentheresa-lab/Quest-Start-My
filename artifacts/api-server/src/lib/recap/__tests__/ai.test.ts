import { afterEach, describe, expect, it } from "vitest";
import { buildAiRecap, setRecapChatClient } from "../ai";
import type { RecapInput } from "../types";

const baseDate = new Date("2026-04-28T22:00:00Z");

function pillar(id: number, name: string): RecapInput["pillars"][number] {
  return {
    id,
    name,
    priority: "P1",
    description: null,
    isActiveThisWeek: true,
    color: "#abc",
    createdAt: baseDate,
    portfolioStatus: null,
    lastUpdated: null,
    category: null,
    honestNote: null,
  };
}

function task(
  id: number,
  title: string,
  areaId: number | null,
  status: "pending" | "blocked" | "done" = "done",
): RecapInput["closedToday"][number] {
  return {
    id,
    title,
    category: "business",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status,
    areaId,
    milestoneId: null,
    blockerReason: null,
    date: "2026-04-28",
    createdAt: baseDate,
    parentTaskId: null,
    stepBackDepth: 0,
    sortOrder: 0,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
  };
}

function makeInput(overrides: Partial<RecapInput> = {}): RecapInput {
  const pillars = [pillar(1, "Operations")];
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 18,
    userFirstName: "Theresa",
    pillars,
    closedToday: [task(1, "Pay out tax", 1)],
    openToday: [task(2, "Schedule call", 1, "pending")],
    reflectionPromptIndex: 0,
    ...overrides,
  };
}

afterEach(() => {
  setRecapChatClient(null);
});

describe("buildAiRecap", () => {
  it("includes closed and rolled tasks in the user prompt", async () => {
    let captured = "";
    setRecapChatClient(async ({ userPrompt }) => {
      captured = userPrompt;
      return JSON.stringify({
        headline: "Solid day.",
        areaBreakdown: "All in Operations.",
        reflectionPrompt: "What clicked today?",
        signoff: "Rest well.",
      });
    });

    const recap = await buildAiRecap(makeInput(), { apiKey: "sk-test" });
    expect(captured).toContain("Pay out tax");
    expect(captured).toContain("Schedule call");
    expect(captured).toContain("Operations");
    expect(recap.source).toBe("ai");
    expect(recap.headline).toBe("Solid day.");
    expect(recap.areaBreakdown).toBe("All in Operations.");
    expect(recap.reflectionPrompt).toBe("What clicked today?");
    expect(recap.signoff).toBe("Rest well.");
    expect(recap.greeting).toBe("Evening, Theresa.");
    expect(recap.closedToday).toHaveLength(1);
    expect(recap.rolledToTomorrow).toHaveLength(1);
  });

  it("falls back to defaults if model returns garbage fields", async () => {
    setRecapChatClient(async () => JSON.stringify({}));
    const recap = await buildAiRecap(makeInput(), { apiKey: "sk-test" });
    expect(recap.headline.length).toBeGreaterThan(0);
    expect(recap.reflectionPrompt).toMatch(/\?$/);
    expect(recap.signoff.length).toBeGreaterThan(0);
  });

  it("aborts if the model takes too long", async () => {
    setRecapChatClient(({ signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    await expect(
      buildAiRecap(makeInput(), { apiKey: "sk-test", timeoutMs: 10 }),
    ).rejects.toThrow();
  });
});
