import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// These tests live in api-server's vitest suite (the only configured suite at
// the time of writing) but assert client-side onboarding copy. They guard
// against accidental "pillar" regressions in user-facing strings that the
// bundle scanner couldn't catch in a meaningful way (e.g. before a build runs).

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("onboarding copy sweep (Phase 10)", () => {
  it("starter areas use natural-sounding area names", () => {
    const src = read("artifacts/quest-start-my-day/src/lib/starter-areas.ts");
    // Naturally-named areas (not "pillar projects").
    expect(src).toMatch(/name:\s*"Operations"/);
    expect(src).toMatch(/name:\s*"Family"/);
    expect(src).toMatch(/name:\s*"Health"/);
    expect(src).not.toMatch(/[Pp]illar/);
  });

  it("onboarding wizard frames areas as lightweight and skippable", () => {
    const src = read("artifacts/quest-start-my-day/src/components/onboarding-wizard.tsx");
    expect(src).toMatch(/areas?/i);
    expect(src).toMatch(/lightweight/i);
    expect(src).toMatch(/Skip/i);
    expect(src).toMatch(/morning briefing/i);
    // No pillar copy.
    expect(src).not.toMatch(/\bPillar\b/);
    expect(src).not.toMatch(/\bpillars?\b(?!:)/);
  });

  it("dashboard checklist references areas and the morning briefing", () => {
    const src = read("artifacts/quest-start-my-day/src/components/onboarding-checklist.tsx");
    expect(src).toMatch(/Set up your areas/i);
    expect(src).toMatch(/Read your morning briefing/i);
    expect(src).not.toMatch(/Set up your pillars/i);
  });

  it("PWA manifest avoids 'pillar' and frames Quest as a chief of staff", () => {
    const manifest = JSON.parse(read("artifacts/quest-start-my-day/public/manifest.json"));
    expect(manifest.name.toLowerCase()).not.toContain("pillar");
    expect(manifest.description.toLowerCase()).not.toContain("pillar");
    expect(manifest.description).toMatch(/areas?/i);
  });

  it("index.html title and meta avoid 'pillar'", () => {
    const html = read("artifacts/quest-start-my-day/index.html");
    expect(html.toLowerCase()).not.toContain("pillar");
    expect(html).toMatch(/<title>[^<]*chief of staff/i);
  });
});
