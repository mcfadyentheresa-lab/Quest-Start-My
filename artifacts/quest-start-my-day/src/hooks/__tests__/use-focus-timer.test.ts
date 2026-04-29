import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampDuration,
  fireCompletionNotification,
  playChime,
  requestNotificationPermission,
  tickDown,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} from "../use-focus-timer";

describe("clampDuration", () => {
  it("clamps below the minimum to MIN_DURATION_MINUTES", () => {
    expect(clampDuration(0)).toBe(MIN_DURATION_MINUTES);
    expect(clampDuration(-30)).toBe(MIN_DURATION_MINUTES);
  });

  it("clamps above the maximum to MAX_DURATION_MINUTES", () => {
    expect(clampDuration(500)).toBe(MAX_DURATION_MINUTES);
    expect(clampDuration(MAX_DURATION_MINUTES + 1)).toBe(MAX_DURATION_MINUTES);
  });

  it("rounds non-integer values", () => {
    expect(clampDuration(7.4)).toBe(7);
    expect(clampDuration(7.6)).toBe(8);
  });

  it("returns 25 for non-finite values", () => {
    expect(clampDuration(Number.NaN)).toBe(25);
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBe(25);
  });

  it("passes through values inside the range", () => {
    expect(clampDuration(1)).toBe(1);
    expect(clampDuration(25)).toBe(25);
    expect(clampDuration(180)).toBe(180);
  });
});

describe("tickDown", () => {
  it("decrements while above 1", () => {
    expect(tickDown(60)).toEqual({ remaining: 59, finished: false });
    expect(tickDown(2)).toEqual({ remaining: 1, finished: false });
  });

  it("finishes at 1 (the final second tick)", () => {
    expect(tickDown(1)).toEqual({ remaining: 0, finished: true });
  });

  it("finishes when remaining is already 0", () => {
    expect(tickDown(0)).toEqual({ remaining: 0, finished: true });
  });
});

describe("countdown driven by tickDown + setInterval", () => {
  it("counts down to 0 and triggers a single completion handler", () => {
    vi.useFakeTimers();
    let remaining = 5;
    let completed = 0;
    const id = setInterval(() => {
      const next = tickDown(remaining);
      remaining = next.remaining;
      if (next.finished) { completed += 1; clearInterval(id); }
    }, 1000);

    vi.advanceTimersByTime(4000);
    expect(remaining).toBe(1);
    expect(completed).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(remaining).toBe(0);
    expect(completed).toBe(1);

    vi.advanceTimersByTime(5000);
    expect(completed).toBe(1);

    vi.useRealTimers();
  });
});

describe("playChime sound gating", () => {
  it("does nothing when sound is disabled (no AudioContext required)", () => {
    const originalAC = (window as unknown as { AudioContext?: unknown }).AudioContext;
    let constructed = 0;
    (window as unknown as { AudioContext: unknown }).AudioContext = function FakeCtx() {
      constructed += 1;
      return { state: "running", currentTime: 0 };
    };
    try {
      playChime(false);
      expect(constructed).toBe(0);
    } finally {
      (window as unknown as { AudioContext?: unknown }).AudioContext = originalAC;
    }
  });
});

describe("fireCompletionNotification", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    if (originalNotification === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification;
    } else {
      (globalThis as { Notification?: unknown }).Notification = originalNotification;
    }
  });

  it("returns false when notifications feature is disabled", () => {
    expect(fireCompletionNotification("Task A", false)).toBe(false);
  });

  it("returns false when Notification API is unsupported", () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    expect(fireCompletionNotification("Task A", true)).toBe(false);
  });

  it("returns false when permission is denied", () => {
    class DeniedNotification {
      static permission = "denied";
    }
    (globalThis as { Notification?: unknown }).Notification = DeniedNotification;
    expect(fireCompletionNotification("Task A", true)).toBe(false);
  });

  it("fires a notification when permission is granted", () => {
    const created: Array<{ title: string; opts: { body?: string } }> = [];
    class GrantedNotification {
      static permission = "granted";
      constructor(title: string, opts: { body?: string }) {
        created.push({ title, opts });
      }
    }
    (globalThis as { Notification?: unknown }).Notification = GrantedNotification;
    expect(fireCompletionNotification("Read book", true)).toBe(true);
    expect(created.length).toBe(1);
    expect(created[0].title).toContain("Focus block complete");
    expect(created[0].opts.body).toContain("Read book");
  });

  it("uses generic body when no task title is provided", () => {
    const created: Array<{ opts: { body?: string } }> = [];
    class GrantedNotification {
      static permission = "granted";
      constructor(_title: string, opts: { body?: string }) { created.push({ opts }); }
    }
    (globalThis as { Notification?: unknown }).Notification = GrantedNotification;
    expect(fireCompletionNotification(null, true)).toBe(true);
    expect(created[0].opts.body).toBe("Focus block complete");
  });
});

describe("requestNotificationPermission", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    if (originalNotification === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification;
    } else {
      (globalThis as { Notification?: unknown }).Notification = originalNotification;
    }
    vi.restoreAllMocks();
  });

  it("returns 'unsupported' when Notification API is missing", async () => {
    delete (globalThis as { Notification?: unknown }).Notification;
    await expect(requestNotificationPermission()).resolves.toBe("unsupported");
  });

  it("short-circuits to 'granted' when already granted", async () => {
    const requestSpy = vi.fn();
    class GrantedNotification {
      static permission = "granted";
      static requestPermission = requestSpy;
    }
    (globalThis as { Notification?: unknown }).Notification = GrantedNotification;
    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("short-circuits to 'denied' when already denied (graceful fallback)", async () => {
    const requestSpy = vi.fn();
    class DeniedNotification {
      static permission = "denied";
      static requestPermission = requestSpy;
    }
    (globalThis as { Notification?: unknown }).Notification = DeniedNotification;
    await expect(requestNotificationPermission()).resolves.toBe("denied");
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("returns 'denied' when requestPermission throws", async () => {
    class DefaultNotification {
      static permission = "default";
      static requestPermission = vi.fn().mockRejectedValue(new Error("nope"));
    }
    (globalThis as { Notification?: unknown }).Notification = DefaultNotification;
    await expect(requestNotificationPermission()).resolves.toBe("denied");
  });
});
