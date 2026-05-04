import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { useEffect } from "react";

// Mirror of the redirect targets wired up in `App.tsx`. The component
// implementation under test is the same `Redirect` shape used there: an
// effect-only component that calls `navigate(to, { replace: true })` on mount.
function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

function TestRouter() {
  return (
    <Switch>
      <Route path="/today">{() => <span data-testid="today" />}</Route>
      <Route path="/capture">{() => <span data-testid="capture" />}</Route>
      <Route path="/calendar">{() => <span data-testid="calendar" />}</Route>
      <Route path="/areas">{() => <span data-testid="areas" />}</Route>
      <Route path="/home">{() => <span data-testid="home" />}</Route>
      <Route path="/">{() => <Redirect to="/today" />}</Route>
      <Route path="/weekly">{() => <Redirect to="/calendar?view=week" />}</Route>
      <Route path="/history">{() => <Redirect to="/calendar?view=history" />}</Route>
      <Route path="/review">{() => <Redirect to="/calendar?view=month" />}</Route>
      <Route path="/year">{() => <Redirect to="/calendar?view=year" />}</Route>
      <Route path="/pillars">{() => <Redirect to="/areas" />}</Route>
      <Route path="/inbox">{() => <Redirect to="/capture" />}</Route>
      <Route>{() => <span data-testid="not-found" />}</Route>
    </Switch>
  );
}

describe("legacy route redirects", () => {
  const cases: Array<{ from: string; to: string }> = [
    { from: "/", to: "/today" },
    { from: "/weekly", to: "/calendar?view=week" },
    { from: "/history", to: "/calendar?view=history" },
    { from: "/review", to: "/calendar?view=month" },
    { from: "/year", to: "/calendar?view=year" },
    { from: "/pillars", to: "/areas" },
    { from: "/inbox", to: "/capture" },
  ];

  it.each(cases)("$from -> $to", async ({ from, to }) => {
    const { hook, history } = memoryLocation({ path: from, record: true });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WouterRouter hook={hook}>
          <TestRouter />
        </WouterRouter>
      );
    });

    expect(history.at(-1) ?? "").toBe(to);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("/today and /areas are NOT redirected", async () => {
    for (const path of ["/today", "/areas"]) {
      const { hook, history } = memoryLocation({ path, record: true });
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          <WouterRouter hook={hook}>
            <TestRouter />
          </WouterRouter>
        );
      });
      // Only the original path should be in the history; no redirect was triggered.
      expect(history).toEqual([path]);
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
