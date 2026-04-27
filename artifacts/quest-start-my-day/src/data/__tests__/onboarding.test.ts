import { describe, expect, it } from "vitest";
import { shouldShowChecklist, shouldShowWizard, type MeResponse } from "../onboarding";

const baseUser: MeResponse = {
  id: "u1",
  email: "u@example.com",
  name: null,
  timezone: "America/Toronto",
  onboardedAt: null,
  dismissedChecklist: null,
};

describe("shouldShowWizard", () => {
  it("returns true for a fresh user with zero pillars", () => {
    expect(
      shouldShowWizard({ user: baseUser, pillarCount: 0, isLoading: false }),
    ).toBe(true);
  });

  it("returns false while data is loading", () => {
    expect(
      shouldShowWizard({ user: baseUser, pillarCount: 0, isLoading: true }),
    ).toBe(false);
  });

  it("returns false if user already onboarded", () => {
    expect(
      shouldShowWizard({
        user: { ...baseUser, onboardedAt: "2026-01-01T00:00:00Z" },
        pillarCount: 0,
        isLoading: false,
      }),
    ).toBe(false);
  });

  it("returns false if user already has pillars (Theresa case)", () => {
    expect(
      shouldShowWizard({ user: baseUser, pillarCount: 7, isLoading: false }),
    ).toBe(false);
  });

  it("returns false if pillar count is undefined (still resolving)", () => {
    expect(
      shouldShowWizard({ user: baseUser, pillarCount: undefined, isLoading: false }),
    ).toBe(false);
  });

  it("returns false if user data is missing", () => {
    expect(
      shouldShowWizard({ user: undefined, pillarCount: 0, isLoading: false }),
    ).toBe(false);
  });
});

describe("shouldShowChecklist", () => {
  it("returns true once onboarded and not yet dismissed", () => {
    expect(
      shouldShowChecklist({
        user: { ...baseUser, onboardedAt: "2026-01-01T00:00:00Z" },
      }),
    ).toBe(true);
  });

  it("returns false until the wizard has been completed", () => {
    expect(shouldShowChecklist({ user: baseUser })).toBe(false);
  });

  it("returns false after dismissal", () => {
    expect(
      shouldShowChecklist({
        user: {
          ...baseUser,
          onboardedAt: "2026-01-01T00:00:00Z",
          dismissedChecklist: "2026-01-02T00:00:00Z",
        },
      }),
    ).toBe(false);
  });

  it("returns false when the user is missing", () => {
    expect(shouldShowChecklist({ user: undefined })).toBe(false);
  });
});
