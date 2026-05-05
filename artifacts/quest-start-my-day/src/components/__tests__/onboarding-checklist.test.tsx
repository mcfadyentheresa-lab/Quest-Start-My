import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OnboardingChecklist, shouldAutoDismiss, markBriefingViewed } from "../onboarding-checklist";

const STORAGE_KEY = "quest_checklist_state_v1";
const BRIEFING_VIEWED_KEY = "quest_briefing_viewed_v1";

describe("shouldAutoDismiss", () => {
  it("does not dismiss with 0 or 1 items complete", () => {
    expect(shouldAutoDismiss(0)).toBe(false);
    expect(shouldAutoDismiss(1)).toBe(false);
  });

  it("dismisses once 2 of 3 items are complete", () => {
    expect(shouldAutoDismiss(2)).toBe(true);
  });

  it("dismisses when 3 of 3 items are complete", () => {
    expect(shouldAutoDismiss(3)).toBe(true);
  });
});

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  // useEffect doesn't fire under renderToStaticMarkup, so these tests verify
  // the render-time guard. The auto-dismiss effect itself is covered by the
  // shouldAutoDismiss unit tests above.

  it("renders the checklist when 0 items are complete", () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist hasAreas={false} hasTasks={false} />,
    );
    expect(html).toContain('data-testid="onboarding-checklist"');
    expect(html).toContain("Get set up");
  });

  it("renders the checklist when only 1 item is complete (hasAreas)", () => {
    const html = renderToStaticMarkup(
      <OnboardingChecklist hasAreas={true} hasTasks={false} />,
    );
    expect(html).toContain('data-testid="onboarding-checklist"');
  });

  it("returns null when persisted state is dismissed", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissed: true, manuallyCompleted: [] }),
    );
    const html = renderToStaticMarkup(
      <OnboardingChecklist hasAreas={true} hasTasks={true} />,
    );
    expect(html).toBe("");
  });

  it("markBriefingViewed writes the briefing-viewed flag", () => {
    expect(localStorage.getItem(BRIEFING_VIEWED_KEY)).toBeNull();
    markBriefingViewed();
    expect(localStorage.getItem(BRIEFING_VIEWED_KEY)).toBe("true");
  });
});
