import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BriefingCard,
  BriefingCardSkeleton,
  BriefingCardError,
} from "../briefing-card";
import type { BriefingResponse } from "@workspace/api-client-react";

const briefing: BriefingResponse = {
  greeting: "Good morning, Theresa.",
  headline: "Three things matter today.",
  context:
    "You closed Pay out Terry's income tax yesterday — carrying momentum into Aster & Spruce Living, your P1 this week.",
  briefing: [
    {
      taskId: 101,
      title: "Draft the Aster onboarding script",
      pillarName: "Aster & Spruce Living",
      pillarColor: "#7d8a6f",
      priority: "P1",
      reasoning: "Surfaced because Aster & Spruce Living is your P1 this week.",
      estimatedMinutes: 25,
      suggestedNextStep: null,
      blockedBy: null,
    },
  ],
  signoff: "I've got the rest of the week on the radar. Tap any item to start.",
  date: "2026-04-28",
  source: "rules",
  approved: false,
  generatedAt: "2026-04-28T12:00:00Z",
};

describe("BriefingCard", () => {
  it("renders headline context, item title, pillar, and priority", () => {
    const noop = vi.fn();
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={briefing}
        isReshuffling={false}
        isApproving={false}
        onApprove={noop}
        onReshuffle={noop}
        onAddOwn={noop}
        onStartFocus={noop}
        onMarkDone={noop}
        onPushTask={noop}
        onMarkBlocked={noop}
      />,
    );

    expect(html).toContain("Draft the Aster onboarding script");
    expect(html).toContain("Aster &amp; Spruce Living");
    expect(html).toContain("Surfaced because");
    expect(html).toContain("P1");
    expect(html).toContain("Approve");
    expect(html).toContain("Reshuffle");
  });

  it("shows 'Plan locked in' when approved", () => {
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={{ ...briefing, approved: true }}
        isReshuffling={false}
        isApproving={false}
        onApprove={() => {}}
        onReshuffle={() => {}}
        onAddOwn={() => {}}
        onStartFocus={() => {}}
        onMarkDone={() => {}}
        onPushTask={() => {}}
        onMarkBlocked={() => {}}
      />,
    );
    expect(html).toContain("Plan locked in");
  });

  it("renders empty-state when there are no briefing items", () => {
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={{ ...briefing, briefing: [] }}
        isReshuffling={false}
        isApproving={false}
        onApprove={() => {}}
        onReshuffle={() => {}}
        onAddOwn={() => {}}
        onStartFocus={() => {}}
        onMarkDone={() => {}}
        onPushTask={() => {}}
        onMarkBlocked={() => {}}
      />,
    );
    expect(html).toContain("No open tasks today");
  });
});

describe("BriefingCardSkeleton", () => {
  it("renders three skeleton placeholder rows", () => {
    const html = renderToStaticMarkup(<BriefingCardSkeleton />);
    expect(html).toContain('data-testid="briefing-skeleton"');
    const rounded = html.match(/rounded-full/g) ?? [];
    expect(rounded.length).toBeGreaterThanOrEqual(3);
  });
});

describe("BriefingCardError", () => {
  it("offers a retry button", () => {
    const html = renderToStaticMarkup(<BriefingCardError onRetry={() => {}} />);
    expect(html).toMatch(/Couldn(&#x27;|')t reach your assistant/);
    expect(html).toContain("Try again");
  });
});
