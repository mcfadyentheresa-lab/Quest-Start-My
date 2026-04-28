#!/usr/bin/env tsx
// CI guard: scan the built client bundle for any user-facing "pillar" strings.
// Migration files (e.g. lib/db/migrations/0001_rename_pillars_to_areas.sql) are
// historical references and remain on disk — they are excluded by allowlist.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const DIST_DIR = resolve(ROOT, "artifacts", "dist");

// Files that legitimately contain "pillar" — historical migration references,
// generated API clients tracking the as-yet-unmigrated DB column names, and the
// guard script itself. Update with care.
const ALLOWLIST_PATTERNS: RegExp[] = [
  /lib\/db\/migrations\/.*pillar.*\.(sql|ts|md)$/i,
  /lib\/db\/migrations\/meta\//,
];

const TARGET_EXTS = new Set([".js", ".mjs", ".cjs", ".css", ".html"]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function isAllowlisted(rel: string): boolean {
  return ALLOWLIST_PATTERNS.some(rx => rx.test(rel));
}

function main() {
  const files = walk(DIST_DIR).filter(f => {
    const ext = f.slice(f.lastIndexOf("."));
    return TARGET_EXTS.has(ext);
  });

  if (files.length === 0) {
    console.error(`No bundle files found in ${DIST_DIR}. Did you run \`pnpm --filter @workspace/quest-start-my-day build\` first?`);
    process.exit(2);
  }

  const offenders: { file: string; matches: string[] }[] = [];

  // Match "pillar" only when it appears as user-facing prose — i.e. flanked on
  // at least one side by something prose-like (whitespace, sentence punctuation,
  // a closing JSX tag, or a quote). This deliberately excludes bundled JS
  // identifiers, URL path segments (`/api/pillars`), object property keys
  // (`{pillar:` and `(I.pillars??[])`), DOM ids/CSS classes (`review-pillars-…`),
  // and similar code-shaped occurrences derived from the as-yet-unmigrated DB
  // column names. Phase 8 will rename those columns; until then we only
  // enforce the absence of human-readable pillar copy in the bundle.
  // The leading boundary intentionally excludes `.` — in minified JS, `.pillars`
  // is property access, not the end of a sentence. The trailing boundary
  // excludes `.` and `?` for the same reason (`.pillars?`, `.pillars??[]`).
  const LEADING = String.raw`(?:^|[\s,;!?"'>}\])])`;
  const TRAILING = String.raw`(?=[\s,;!"'<({\[]|$)`;
  const pillarRx = new RegExp(`${LEADING}([Pp]illars?)${TRAILING}`, "g");

  // Filename check — chunk names rolled up by the bundler can leak source file names.
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (isAllowlisted(rel)) continue;
    if (pillarRx.test(rel)) {
      offenders.push({ file: rel, matches: [`(filename contains "pillar")`] });
    }
    pillarRx.lastIndex = 0;
  }

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (isAllowlisted(rel)) continue;
    let content: string;
    try { content = readFileSync(file, "utf8"); } catch { continue; }
    const matches = content.match(pillarRx);
    if (matches && matches.length > 0) {
      // Capture short snippets around each match for the report.
      const snippets: string[] = [];
      let m: RegExpExecArray | null;
      const local = /\bpillars?\b/gi;
      while ((m = local.exec(content)) !== null && snippets.length < 5) {
        const start = Math.max(0, m.index - 30);
        const end = Math.min(content.length, m.index + 40);
        snippets.push(content.slice(start, end).replace(/\s+/g, " ").trim());
      }
      offenders.push({ file: rel, matches: snippets });
    }
  }

  if (offenders.length > 0) {
    console.error(`\nFAIL: Found "pillar" strings in built client bundle (case-insensitive).`);
    console.error(`The product copy should reference "areas" — see Phase 10.\n`);
    for (const o of offenders) {
      console.error(`  ${o.file}`);
      for (const s of o.matches) {
        console.error(`    … ${s} …`);
      }
    }
    console.error(`\n${offenders.length} file(s) contain banned strings.`);
    process.exit(1);
  }

  console.log(`OK: no "pillar" strings found in ${files.length} bundle file(s).`);
}

main();
