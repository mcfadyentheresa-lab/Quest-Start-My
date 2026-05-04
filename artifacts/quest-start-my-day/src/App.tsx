import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import { FocusTimerProvider } from "@/hooks/use-focus-timer";

const TodayPage = lazy(() => import("@/pages/today"));
const CapturePage = lazy(() => import("@/pages/capture"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const HomeModulePage = lazy(() => import("@/pages/home-module"));
const AreasPage = lazy(() => import("@/pages/areas"));
const AreaDetailPage = lazy(() => import("@/pages/area-detail"));
const NotFound = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

// Bookmarks and outbound links from earlier versions of the app may still
// hit `/`, `/weekly`, `/history`, `/home`, or `/review` — fold them into the
// new shape rather than 404. Each redirect uses `replace` so the back button
// doesn't trap the user on a redirect frame.
function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

function Router() {
  const [location] = useLocation();
  // The sign-in page renders bare (no top nav, no bottom tabs, no
  // floating Inbox pill) so the form is the only thing on screen.
  // Wouter doesn't have nested layouts, so we branch here.
  if (location === "/sign-in") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SignInPage />
      </Suspense>
    );
  }
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/today" component={TodayPage} />
          <Route path="/capture" component={CapturePage} />
          {/* /inbox is the previous name for the trust-layer view; keep
              the URL alive so bookmarks don't 404. */}
          <Route path="/inbox">{() => <Redirect to="/capture" />}</Route>
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/areas" component={AreasPage} />
          {/* Per-area brain-dump page (Phase 2). Mounted after /areas so
              the more specific path wins routing in wouter's Switch. */}
          <Route path="/areas/:id" component={AreaDetailPage} />
          {/* Reset / wellness flow. No longer in the bottom nav — reached
              from Today's empty-state link. */}
          <Route path="/home" component={HomeModulePage} />

          {/* Legacy redirects */}
          <Route path="/">{() => <Redirect to="/today" />}</Route>
          <Route path="/weekly">{() => <Redirect to="/calendar?view=week" />}</Route>
          <Route path="/history">{() => <Redirect to="/calendar?view=history" />}</Route>
          <Route path="/review">{() => <Redirect to="/calendar?view=month" />}</Route>
          {/* /year is the natural URL users type — audit caught a 404. Map
              it to the existing year sub-view of the calendar page. */}
          <Route path="/year">{() => <Redirect to="/calendar?view=year" />}</Route>
          {/* Legacy alias: /pillars was the previous name for areas. */}
          <Route path="/pillars">{() => <Redirect to="/areas" />}</Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

// Resolve the router base once. wouter expects either an absolute prefix
// like "/app" or no prop at all when mounted at the domain root. Passing "/"
// or "" can cause matching oddities.
const rawBase = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

function App() {
  const routerTree = <Router />;
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <FocusTimerProvider>
          {rawBase ? (
            <WouterRouter base={rawBase}>{routerTree}</WouterRouter>
          ) : (
            routerTree
          )}
          <Toaster />
        </FocusTimerProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
