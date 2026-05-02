import { describe, expect, it } from "vitest";
import { parseList, parseStepsPaste, stripBulletPrefix } from "../parse-list";

describe("stripBulletPrefix", () => {
  it("strips dash, asterisk, bullet, en/em dashes", () => {
    expect(stripBulletPrefix("- one")).toBe("one");
    expect(stripBulletPrefix("* two")).toBe("two");
    expect(stripBulletPrefix("• three")).toBe("three");
    expect(stripBulletPrefix("– four")).toBe("four");
    expect(stripBulletPrefix("— five")).toBe("five");
  });

  it("strips numbered list prefixes", () => {
    expect(stripBulletPrefix("1. one")).toBe("one");
    expect(stripBulletPrefix("1) two")).toBe("two");
    expect(stripBulletPrefix("(1) three")).toBe("three");
    expect(stripBulletPrefix("12: four")).toBe("four");
  });

  it("leaves untagged lines untouched", () => {
    expect(stripBulletPrefix("a sentence")).toBe("a sentence");
  });

  it("trims whitespace around the prefix", () => {
    expect(stripBulletPrefix("   -   six")).toBe("six");
  });
});

describe("parseList", () => {
  it("returns [] for empty / whitespace-only input", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList("   \n  \n\t")).toEqual([]);
  });

  it("splits on newlines and trims", () => {
    expect(parseList("a\nb\nc")).toEqual(["a", "b", "c"]);
    expect(parseList("  a  \r\n  b  ")).toEqual(["a", "b"]);
  });

  it("drops empty lines between entries", () => {
    expect(parseList("a\n\n\nb")).toEqual(["a", "b"]);
  });

  it("strips mixed bullet styles by default", () => {
    expect(parseList("- a\n* b\n• c\n1. d")).toEqual(["a", "b", "c", "d"]);
  });

  it("can be told not to strip bullets", () => {
    expect(parseList("- a", { stripBullets: false })).toEqual(["- a"]);
  });

  it("caps each entry at maxLength", () => {
    const long = "x".repeat(500);
    expect(parseList(long)[0]!.length).toBe(280);
    expect(parseList(long, { maxLength: 10 })[0]!.length).toBe(10);
  });

  it("does NOT split on commas (that's parseStepsPaste's job)", () => {
    expect(parseList("a, b, c")).toEqual(["a, b, c"]);
  });
});

describe("parseStepsPaste", () => {
  it("acts like parseList for multi-line input", () => {
    expect(parseStepsPaste("- a\n- b")).toEqual(["a", "b"]);
  });

  it("splits a single comma-separated line of short chunks", () => {
    expect(parseStepsPaste("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("does NOT split commas if any chunk is too long", () => {
    const long = "x".repeat(90);
    expect(parseStepsPaste(`short, ${long}`)).toEqual([`short, ${long}`]);
  });

  it("does NOT split commas with only one chunk", () => {
    expect(parseStepsPaste("just one thing")).toEqual(["just one thing"]);
  });

  it("strips bullets from comma chunks", () => {
    expect(parseStepsPaste("- a, - b, - c")).toEqual(["a", "b", "c"]);
  });

  it("respects commaSplitMaxChunk: 0 to disable comma split", () => {
    expect(parseStepsPaste("a, b, c", { commaSplitMaxChunk: 0 })).toEqual([
      "a, b, c",
    ]);
  });

  it("returns [] for empty input", () => {
    expect(parseStepsPaste("")).toEqual([]);
    expect(parseStepsPaste("   \n  ")).toEqual([]);
  });
});
