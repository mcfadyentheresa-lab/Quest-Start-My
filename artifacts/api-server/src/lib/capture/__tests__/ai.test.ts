import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_CLEAN_THRESHOLD_CHARS,
  cleanBrainDump,
  fallbackCleanBrainDump,
  setCaptureChatClient,
  SYSTEM_PROMPT,
} from "../ai";

afterEach(() => {
  setCaptureChatClient(null);
  vi.restoreAllMocks();
});

describe("cleanBrainDump", () => {
  it("returns a clean shape from a well-formed model response", async () => {
    setCaptureChatClient(async () =>
      JSON.stringify({
        title: "Sketch furniture box concept",
        whyItMatters:
          "Wants a tactile presentation kit for showing clients new collections.",
        doneLooksLike: "A rough mock of the box's contents, layout, and packaging.",
      }),
    );
    const out = await cleanBrainDump(
      "i want to make a furniture box thing with samples and a nice smell so clients can take it home and decide",
      { areaName: "Aster & Spruce Living", areaDescription: null },
      "fake-key",
    );
    expect(out.title).toBe("Sketch furniture box concept");
    expect(out.whyItMatters).toContain("clients");
    expect(out.doneLooksLike).toMatch(/box/i);
  });

  it("strips ```json fences if model wrapped output in markdown", async () => {
    setCaptureChatClient(
      async () =>
        '```json\n{"title":"Outline blog post","whyItMatters":null,"doneLooksLike":null}\n```',
    );
    const out = await cleanBrainDump(
      "blog post idea ".repeat(20),
      { areaName: null, areaDescription: null },
      "fake-key",
    );
    expect(out.title).toBe("Outline blog post");
    expect(out.whyItMatters).toBeNull();
    expect(out.doneLooksLike).toBeNull();
  });

  it("trims absurdly long titles to 80 chars", async () => {
    setCaptureChatClient(async () =>
      JSON.stringify({
        title: "x".repeat(200),
        whyItMatters: null,
        doneLooksLike: null,
      }),
    );
    const out = await cleanBrainDump(
      "long".repeat(50),
      { areaName: null, areaDescription: null },
      "fake-key",
    );
    expect(out.title.length).toBeLessThanOrEqual(80);
  });

  it("throws on empty title from model", async () => {
    setCaptureChatClient(async () =>
      JSON.stringify({ title: "   ", whyItMatters: null, doneLooksLike: null }),
    );
    await expect(
      cleanBrainDump(
        "anything anything",
        { areaName: null, areaDescription: null },
        "fake-key",
      ),
    ).rejects.toThrow(/title/);
  });

  it("throws on non-JSON model output", async () => {
    setCaptureChatClient(async () => "this is not json at all");
    await expect(
      cleanBrainDump(
        "something",
        { areaName: null, areaDescription: null },
        "fake-key",
      ),
    ).rejects.toThrow(/JSON/);
  });

  it("includes area context in the prompt when provided", async () => {
    const seen: string[] = [];
    setCaptureChatClient(async ({ userPrompt }) => {
      seen.push(userPrompt);
      return JSON.stringify({
        title: "Test task",
        whyItMatters: null,
        doneLooksLike: null,
      });
    });
    await cleanBrainDump(
      "some text",
      { areaName: "Social Media", areaDescription: "weekly cadence" },
      "fake-key",
    );
    expect(seen[0]).toContain("Social Media");
    expect(seen[0]).toContain("weekly cadence");
  });

  it("system prompt enforces strict JSON output", () => {
    expect(SYSTEM_PROMPT).toMatch(/STRICT JSON/);
    expect(SYSTEM_PROMPT).toMatch(/title/);
  });
});

describe("fallbackCleanBrainDump", () => {
  it("uses the text verbatim when short", () => {
    const out = fallbackCleanBrainDump("Email Sara about the rebrand");
    expect(out.title).toBe("Email Sara about the rebrand");
  });

  it("truncates at first sentence break", () => {
    const out = fallbackCleanBrainDump(
      "Sketch the furniture box concept. With samples and a candle inside.",
    );
    expect(out.title).toBe("Sketch the furniture box concept");
  });

  it("falls back to 60-char head when no punctuation", () => {
    const out = fallbackCleanBrainDump(
      "this is a really long brain dump with absolutely no punctuation anywhere just thoughts running",
    );
    expect(out.title.length).toBeLessThanOrEqual(80);
    expect(out.title.startsWith("This is a really long brain dump")).toBe(true);
  });

  it("returns a placeholder for empty input", () => {
    const out = fallbackCleanBrainDump("   ");
    expect(out.title).toBe("Untitled capture");
  });

  it("never returns whyItMatters or doneLooksLike (cannot infer offline)", () => {
    const out = fallbackCleanBrainDump("Sketch the furniture box");
    expect(out.whyItMatters).toBeNull();
    expect(out.doneLooksLike).toBeNull();
  });

  it("capitalises the first letter", () => {
    const out = fallbackCleanBrainDump("sketch the furniture box");
    expect(out.title.charAt(0)).toBe("S");
  });
});

describe("AI_CLEAN_THRESHOLD_CHARS", () => {
  it("is a small positive integer", () => {
    expect(AI_CLEAN_THRESHOLD_CHARS).toBeGreaterThan(0);
    expect(AI_CLEAN_THRESHOLD_CHARS).toBeLessThan(200);
  });
});
