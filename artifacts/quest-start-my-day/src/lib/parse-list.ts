// Shared parsing helpers for the various textareas the user types lists into:
// inbox composer, brain-dump, bulk-add milestones / steps, monthly-reflection
// priorities. The three behaviours we need are:
//
// 1. plain newline-separated list (with optional bullet/number prefixes stripped)
// 2. newline list, but a single comma-separated short line should also split
//    (the goal-card "bulk add steps" path)
// 3. shared bullet-prefix stripping for either of the above
//
// All variants trim whitespace, drop empty lines, and cap each entry at
// `maxLength` chars (default 280) so a paste of an essay doesn't create one
// 50KB title.

const DEFAULT_MAX_LENGTH = 280;

/**
 * Strip a leading bullet/number prefix from a single line.
 * Handles: -, *, •, –, — (em dash), with optional spaces.
 * Numbers: 1.  1)  (1)  1:
 */
export function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•–—]|\(\d+\)|\d+[.):])\s+/, "").trim();
}

export interface ParseListOptions {
  /** Strip leading bullet/number prefixes from each line. Default true. */
  stripBullets?: boolean;
  /** Cap each entry at this many characters. Default 280. */
  maxLength?: number;
}

/**
 * Parse a textarea into a list of trimmed, non-empty entries.
 * Splits on newlines, trims each, drops empties, optionally strips bullets,
 * and caps length.
 */
export function parseList(raw: string, opts: ParseListOptions = {}): string[] {
  const { stripBullets = true, maxLength = DEFAULT_MAX_LENGTH } = opts;
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (stripBullets ? stripBulletPrefix(line) : line))
    .filter((line) => line.length > 0)
    .map((line) => (line.length > maxLength ? line.slice(0, maxLength) : line));
}

export interface ParseStepsOptions extends ParseListOptions {
  /**
   * If a single line contains commas and every comma-chunk is shorter than
   * this, split on commas instead. Default 80. Set to 0 to disable comma
   * splitting entirely.
   */
  commaSplitMaxChunk?: number;
}

/**
 * Like {@link parseList}, but if the text is a single line with commas and
 * every comma-chunk is short, treats it as a comma-separated list instead.
 * Used by the goal-card "bulk add steps" path where users paste either a
 * vertical list or a horizontal "a, b, c" sentence.
 */
export function parseStepsPaste(raw: string, opts: ParseStepsOptions = {}): string[] {
  const { commaSplitMaxChunk = 80, maxLength = DEFAULT_MAX_LENGTH } = opts;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (
    commaSplitMaxChunk > 0 &&
    lines.length === 1 &&
    lines[0]!.includes(",")
  ) {
    const chunks = lines[0]!
      .split(",")
      .map((c) => stripBulletPrefix(c).trim())
      .filter((c) => c.length > 0);
    if (chunks.length > 1 && chunks.every((c) => c.length < commaSplitMaxChunk)) {
      return chunks.map((c) => (c.length > maxLength ? c.slice(0, maxLength) : c));
    }
  }

  return lines
    .map((line) => stripBulletPrefix(line))
    .filter((line) => line.length > 0)
    .map((line) => (line.length > maxLength ? line.slice(0, maxLength) : line));
}
