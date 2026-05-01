// Shared list parser. Used by the inbox composer, the area brain dump,
// and the bulk-add-steps panel — all three accept newline-separated text
// (with optional bullet/number prefixes), trim each line, and emit a
// deduplicated, length-capped array of titles.
//
// `stripBullets` toggles removal of leading bullet/number prefixes.
// `allowCommaSplit` enables comma-fallback for short single-line input.

const BULLET_PATTERN = /^\s*(?:[-*•–—]|\(\d+\)|\d+[.):])\s+/;
const MAX_TITLE_LEN = 280;
const COMMA_SPLIT_MAX_CHUNK = 80;

function stripBulletPrefix(line: string): string {
  return line.replace(BULLET_PATTERN, "").trim();
}

function clamp(line: string): string {
  return line.length > MAX_TITLE_LEN ? line.slice(0, MAX_TITLE_LEN) : line;
}

export interface ParseListOptions {
  stripBullets?: boolean;
  allowCommaSplit?: boolean;
}

export function parseList(raw: string, options: ParseListOptions = {}): string[] {
  const { stripBullets = true, allowCommaSplit = false } = options;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allowCommaSplit && lines.length === 1 && lines[0]!.includes(",")) {
    const chunks = lines[0]!
      .split(",")
      .map((c) => (stripBullets ? stripBulletPrefix(c) : c.trim()))
      .filter((c) => c.length > 0);
    if (chunks.length > 1 && chunks.every((c) => c.length < COMMA_SPLIT_MAX_CHUNK)) {
      return chunks.map(clamp);
    }
  }

  const cleaned = stripBullets
    ? lines.map(stripBulletPrefix).filter((l) => l.length > 0)
    : lines;
  return cleaned.map(clamp);
}
