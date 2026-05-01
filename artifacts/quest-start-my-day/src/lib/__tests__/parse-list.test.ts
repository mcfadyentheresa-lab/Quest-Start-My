import { describe, expect, it } from "vitest";
import { parseList } from "../parse-list";

describe("parseList", () => {
  it("splits on newlines and trims", () => {
    expect(parseList("alpha\n  beta  \n\ngamma")).toEqual(["alpha", "beta", "gamma"]);
  });

  it("strips bullet prefixes by default", () => {
    expect(parseList("- one\n* two\n• three\n1. four\n2) five\n(3) six")).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
  });

  it("does not strip bullets when stripBullets is false", () => {
    expect(parseList("- keep dash", { stripBullets: false })).toEqual(["- keep dash"]);
  });

  it("falls back to comma split when allowed and chunks are short", () => {
    expect(parseList("a, b, c", { allowCommaSplit: true })).toEqual(["a", "b", "c"]);
  });

  it("does not comma-split when chunks are long", () => {
    const long = "x".repeat(90) + ", " + "y".repeat(90);
    expect(parseList(long, { allowCommaSplit: true })).toEqual([long]);
  });

  it("does not comma-split without the flag", () => {
    expect(parseList("a, b, c")).toEqual(["a, b, c"]);
  });

  it("clamps lines longer than 280 characters", () => {
    const big = "x".repeat(400);
    expect(parseList(big)[0]).toHaveLength(280);
  });

  it("returns an empty array for empty input", () => {
    expect(parseList("")).toEqual([]);
    expect(parseList("\n\n\n")).toEqual([]);
  });
});
