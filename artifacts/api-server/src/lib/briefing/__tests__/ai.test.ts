import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAiBriefing, setBriefingChatClient } from "../ai";
import type { BriefingInput } from "../types";

const baseDate = new Date("2026-04-28T09:00:00Z");

function pillar(id: number, name: string, priority: "P1" | "P2" | "P3" | "P4", active = true) {
  return {
    id,
    name,
    priority,
    description: null,
    isActiveThisWeek: active,
    color: "#abc",
    createdAt: baseDate,
    portfolioStatus: null,
    currentStage: null,
    whyItMatters: null,
    nowFocus: null,
    nextFocus: null,
    laterFocus: null,
    blockers: null,
    lastUpdated: null,
    featureTag: null,
    category: null,
    honestNote: null,
  } as BriefingInput["pillars"][number];
}

function task(id: number, title: string, areaId: number | null) {
  return {
    id,
    title,
    category: "business",
    whyItMatters: null,
    doneLooksLike: null,
    suggestedNextStep: null,
    status: "pending",
    areaId,
    milestoneId: null,
    blockerReason: null,
    date: "2026-04-28",
    createdAt: baseDate,
    parentTaskId: null,
    stepBackDepth: 0,
    blockerType: null,
    adjustmentType: null,
    adjustmentReason: null,
    taskSource: null,
  } as BriefingInput["openTasks"][number];
}

function makeInput(overrides: Partial<BriefingInput> = {}): BriefingInput {
  const pillars = [pillar(1, "Aster & Spruce Living", "P1")];
  return {
    date: "2026-04-28",
    now: baseDate,
    hourLocal: 9,
    userFirstName: "Theresa",
    pillars,
    activePillars: pillars,
    weeklyPlan: null,
    openTasks: [task(101, "Pay out Terry's income tax", 1)],
    recentlyCompleted: [],
    recentLogs: [],
    milestones: [],
    focusBlockMinutes: 25,
    ...overrides,
  };
}

afterEach(() => {
  setBriefingChatClient(null);
});

describe("buildAiBriefing", () => {
  it("sends user data in the prompt and parses JSON output", async () => {
    let capturedUserPrompt = "";
    setBriefingChatClient(async ({ userPrompt }) => {
      capturedUserPrompt = userPrompt;
      return JSON.stringify({
        headline: "One big move today.",
        context: "Carrying momentum from yesterday's win.",
        signoff: "I'm watching the rest of the week.",
        briefing: [
          {
            taskId: 101,
            title: "Pay out Terry's income tax",
            pillarName: "Aster & Spruce Living",
            priority: "P1",
            reasoning: "Surfaced because it's your P1 this week.",
            suggestedNextStep: "Open the CRA portal",
          },
        ],
      });
    });

    const out = await buildAiBriefing(makeInput(), { apiKey: "sk-test" });
    expect(capturedUserPrompt).toContain("Pay out Terry's income tax");
    expect(capturedUserPrompt).toContain("Aster & Spruce Living");
    expect(out.source).toBe("ai");
    expect(out.briefing).toHaveLength(1);
    expect(out.briefing[0].taskId).toBe(101);
    expect(out.briefing[0].priority).toBe("P1");
    expect(out.briefing[0].reasoning).toMatch(/^Surfaced because/);
    expect(out.briefing[0].pillarColor).toBe("#abc");
    expect(out.greeting).toBe("Good morning, Theresa.");
  });

  it("rejects unknown taskIds (sets to null)", async () => {
    setBriefingChatClient(async () =>
      JSON.stringify({
        headline: "Today",
        context: "x",
        signoff: "y",
        briefing: [
          {
            taskId: 99999,
            title: "Made-up task",
            pillarName: "Aster & Spruce Living",
            priority: "P2",
            reasoning: "Surfaced because we want to test fallback.",
          },
        ],
      }),
    );

    const out = await buildAiBriefing(makeInput(), { apiKey: "sk-test" });
    expect(out.briefing[0].taskId).toBeNull();
  });

  it("propagates errors so the service can fall back to rules", async () => {
    setBriefingChatClient(async () => {
      throw new Error("OpenAI 500: down");
    });
    await expect(buildAiBriefing(makeInput(), { apiKey: "sk-test" })).rejects.toThrow(
      /OpenAI 500/,
    );
  });

  it("supplies safe defaults for missing fields", async () => {
    setBriefingChatClient(async () =>
      JSON.stringify({
        briefing: [
          {
            taskId: 101,
            title: "Pay out Terry's income tax",
            pillarName: "Aster & Spruce Living",
            priority: "P1",
            reasoning: "",
          },
        ],
      }),
    );
    const out = await buildAiBriefing(makeInput(), { apiKey: "sk-test" });
    expect(out.headline.length).toBeGreaterThan(0);
    expect(out.signoff.length).toBeGreaterThan(0);
    expect(out.briefing[0].reasoning).toMatch(/^Surfaced/);
  });

  it("aborts if the chat client takes too long", async () => {
    setBriefingChatClient(
      ({ signal }) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const start = Date.now();
    await expect(
      buildAiBriefing(makeInput(), { apiKey: "sk-test", timeoutMs: 50 }),
    ).rejects.toBeTruthy();
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("setBriefingChatClient", () => {
  it("can be reset to default", () => {
    setBriefingChatClient(vi.fn() as never);
    setBriefingChatClient(null);
    // No assertion beyond it not throwing — default client is restored.
    expect(true).toBe(true);
  });
});
