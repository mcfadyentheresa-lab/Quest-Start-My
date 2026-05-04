import { describe, expect, it } from "vitest";
import { CreateCaptureBody } from "@workspace/api-zod";

describe("CreateCaptureBody", () => {
  it("accepts a minimal body with just text", () => {
    const result = CreateCaptureBody.safeParse({ text: "Email Sara about the rebrand" });
    expect(result.success).toBe(true);
  });

  it("accepts when=today", () => {
    const result = CreateCaptureBody.safeParse({ text: "x", when: "today" });
    expect(result.success).toBe(true);
  });

  it("accepts when=later", () => {
    const result = CreateCaptureBody.safeParse({ text: "x", when: "later" });
    expect(result.success).toBe(true);
  });

  it("accepts an areaId", () => {
    const result = CreateCaptureBody.safeParse({ text: "x", areaId: 4 });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = CreateCaptureBody.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown when value", () => {
    const result = CreateCaptureBody.safeParse({ text: "x", when: "tomorrow" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive areaId", () => {
    const result = CreateCaptureBody.safeParse({ text: "x", areaId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects text over 8000 chars", () => {
    const result = CreateCaptureBody.safeParse({ text: "a".repeat(8001) });
    expect(result.success).toBe(false);
  });
});
