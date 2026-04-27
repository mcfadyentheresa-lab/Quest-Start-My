import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const NEW_TASK_FOCUS_EVENT = "quest:focus-new-task";

export function dispatchFocusNewTask(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NEW_TASK_FOCUS_EVENT));
}

export function useFocusNewTaskListener(handler: () => void): void {
  useEffect(() => {
    const listener = () => handler();
    window.addEventListener(NEW_TASK_FOCUS_EVENT, listener);
    return () => window.removeEventListener(NEW_TASK_FOCUS_EVENT, listener);
  }, [handler]);
}

const OPEN_CHEATSHEET_EVENT = "quest:open-shortcuts";

export function dispatchOpenCheatsheet(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_CHEATSHEET_EVENT));
}

export function useOpenCheatsheetListener(handler: () => void): void {
  useEffect(() => {
    const listener = () => handler();
    window.addEventListener(OPEN_CHEATSHEET_EVENT, listener);
    return () => window.removeEventListener(OPEN_CHEATSHEET_EVENT, listener);
  }, [handler]);
}

/**
 * Returns true when keystrokes should be ignored — the user is typing in an
 * input, textarea, contenteditable, or one of a handful of widget roles.
 *
 * Exported so unit tests can call it without spinning up React.
 */
export function isTypingInEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.("role");
  if (role && ["textbox", "combobox", "searchbox"].includes(role)) return true;
  return false;
}

const SHORTCUT_RESET_MS = 1000;

interface ShortcutBindings {
  navigate: (to: string) => void;
}

function makeKeyHandler({ navigate }: ShortcutBindings) {
  let prevKey: string | null = null;
  let prevTime = 0;

  return (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingInEditableTarget(e.target)) return;

    const now = Date.now();
    const key = e.key;

    // Single-key shortcuts that don't need a chord.
    if (!prevKey || now - prevTime > SHORTCUT_RESET_MS) {
      if (key === "?") {
        e.preventDefault();
        dispatchOpenCheatsheet();
        prevKey = null;
        return;
      }
      if (key === "n") {
        e.preventDefault();
        dispatchFocusNewTask();
        prevKey = null;
        return;
      }
      if (key === "g") {
        prevKey = "g";
        prevTime = now;
        return;
      }
      // Any other key clears any pending chord.
      prevKey = null;
      return;
    }

    // We're in a "g …" chord.
    if (prevKey === "g") {
      prevKey = null;
      switch (key) {
        case "d":
          e.preventDefault();
          navigate("/");
          return;
        case "w":
          e.preventDefault();
          navigate("/weekly");
          return;
        case "p":
          e.preventDefault();
          navigate("/pillars");
          return;
        case "h":
          e.preventDefault();
          navigate("/history");
          return;
        default:
          return;
      }
    }
  };
}

export function useKeyboardShortcuts(): void {
  const [, navigate] = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const handler = makeKeyHandler({
      navigate: (to) => navigateRef.current(to),
    });
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

export const SHORTCUTS: ReadonlyArray<{ keys: string; description: string }> = [
  { keys: "g d", description: "Go to Dashboard" },
  { keys: "g w", description: "Go to This Week" },
  { keys: "g p", description: "Go to Pillars" },
  { keys: "g h", description: "Go to History" },
  { keys: "n", description: "New task on the current page" },
  { keys: "?", description: "Show this cheatsheet" },
];

// Exported for tests
export const __test = { makeKeyHandler };
