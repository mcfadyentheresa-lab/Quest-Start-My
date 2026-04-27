import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isTypingInEditableTarget,
  __test,
} from "@/hooks/use-keyboard-shortcuts";

// Pure-JS shims so this test runs in vitest's "node" environment without
// requiring jsdom.
function fakeElement(opts: {
  tagName: string;
  isContentEditable?: boolean;
  role?: string | null;
}): EventTarget {
  return {
    tagName: opts.tagName,
    isContentEditable: opts.isContentEditable ?? false,
    getAttribute(name: string) {
      if (name === "role") return opts.role ?? null;
      return null;
    },
  } as unknown as EventTarget;
}

function fakeKeyEvent(opts: {
  key: string;
  target: EventTarget;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    target: opts.target,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    altKey: opts.altKey ?? false,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

describe("Phase 6: keyboard-shortcut input guard", () => {
  it("ignores INPUT, TEXTAREA, SELECT", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isTypingInEditableTarget(fakeElement({ tagName: tag }))).toBe(true);
    }
  });

  it("ignores contentEditable elements", () => {
    expect(
      isTypingInEditableTarget(
        fakeElement({ tagName: "DIV", isContentEditable: true }),
      ),
    ).toBe(true);
  });

  it("ignores aria role textbox/combobox/searchbox", () => {
    for (const role of ["textbox", "combobox", "searchbox"]) {
      expect(
        isTypingInEditableTarget(fakeElement({ tagName: "DIV", role })),
      ).toBe(true);
    }
  });

  it("does not ignore plain DIV/BUTTON/A/BODY", () => {
    for (const tag of ["DIV", "BUTTON", "A", "BODY"]) {
      expect(isTypingInEditableTarget(fakeElement({ tagName: tag }))).toBe(false);
    }
  });

  it("returns false for null targets", () => {
    expect(isTypingInEditableTarget(null)).toBe(false);
  });
});

describe("Phase 6: keyboard-shortcut handler routes only when not typing", () => {
  let navigate: ReturnType<typeof vi.fn>;
  let handler: (e: KeyboardEvent) => void;

  beforeEach(() => {
    navigate = vi.fn();
    handler = __test.makeKeyHandler({ navigate });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("'g d' navigates to /", () => {
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "g", target: body }));
    handler(fakeKeyEvent({ key: "d", target: body }));
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("'g w' navigates to /weekly", () => {
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "g", target: body }));
    handler(fakeKeyEvent({ key: "w", target: body }));
    expect(navigate).toHaveBeenCalledWith("/weekly");
  });

  it("'g p' navigates to /pillars", () => {
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "g", target: body }));
    handler(fakeKeyEvent({ key: "p", target: body }));
    expect(navigate).toHaveBeenCalledWith("/pillars");
  });

  it("'g h' navigates to /history", () => {
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "g", target: body }));
    handler(fakeKeyEvent({ key: "h", target: body }));
    expect(navigate).toHaveBeenCalledWith("/history");
  });

  it("does NOT navigate when typing in an INPUT", () => {
    const input = fakeElement({ tagName: "INPUT" });
    handler(fakeKeyEvent({ key: "g", target: input }));
    handler(fakeKeyEvent({ key: "d", target: input }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does NOT navigate when typing in a TEXTAREA", () => {
    const ta = fakeElement({ tagName: "TEXTAREA" });
    handler(fakeKeyEvent({ key: "g", target: ta }));
    handler(fakeKeyEvent({ key: "p", target: ta }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does NOT navigate when typing in a contentEditable", () => {
    const el = fakeElement({ tagName: "DIV", isContentEditable: true });
    handler(fakeKeyEvent({ key: "g", target: el }));
    handler(fakeKeyEvent({ key: "h", target: el }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores meta/ctrl/alt-modified keys (cmd-d must keep browser behavior)", () => {
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "d", target: body, metaKey: true }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a stale 'g' more than 1s old does not pair with the next key", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00Z"));
    const body = fakeElement({ tagName: "BODY" });
    handler(fakeKeyEvent({ key: "g", target: body }));
    vi.setSystemTime(new Date("2026-04-27T12:00:02Z"));
    handler(fakeKeyEvent({ key: "d", target: body }));
    expect(navigate).not.toHaveBeenCalled();
  });
});
