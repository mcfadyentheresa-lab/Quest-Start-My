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
  it("renders the Today's plan title, item, pillar, and priority", () => {
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

    expect(html).toContain("Today&#x27;s plan");
    expect(html).toContain("Draft the Aster onboarding script");
    expect(html).toContain("Aster &amp; Spruce Living");
    expect(html).toContain("Surfaced because");
    expect(html).toContain("P1");
    expect(html).toContain("Lock in today&#x27;s focus");
    expect(html).toContain("Reshuffle");
  });

  it("shows the AI-drafted provenance badge when source is ai", () => {
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={{ ...briefing, source: "ai" }}
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
    expect(html).toContain("AI-drafted");
  });

  it("shows the rules provenance copy when source is rules", () => {
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={{ ...briefing, source: "rules" }}
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
    expect(html).toContain("Drafted from your priorities");
  });

  it("shows the fallback provenance copy when source is fallback", () => {
    const html = renderToStaticMarkup(
      <BriefingCard
        briefing={{ ...briefing, source: "fallback" }}
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
    expect(html).toMatch(/Couldn(&#x27;|')t reach AI/);
  });

  it("shows 'Locked in for today' when approved", () => {
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
    expect(html).toContain("Locked in for today");
  });

  it("renders the empty-state with one-tap fixes when there are no briefing items", () => {
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
        onChooseActiveAreas={() => {}}
        onAddTask={() => {}}
      />,
    );
    expect(html).toContain("Today&#x27;s plan is empty");
    expect(html).toContain("Choose active areas");
    expect(html).toContain("Add task");
    // Provenance badge is hidden in the empty state.
    expect(html).not.toContain("Drafted from your priorities");
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
