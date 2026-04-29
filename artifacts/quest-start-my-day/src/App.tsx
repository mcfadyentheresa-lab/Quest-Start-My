import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import { FocusTimerProvider } from "@/hooks/use-focus-timer";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const TodayPage = lazy(() => import("@/pages/today"));
const WeeklyPage = lazy(() => import("@/pages/weekly"));
const HistoryPage = lazy(() => import("@/pages/history"));
const ReviewPage = lazy(() => import("@/pages/review"));
const AreasPage = lazy(() => import("@/pages/areas"));
const HomeModulePage = lazy(() => import("@/pages/home-module"));
const NotFound = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/today" component={TodayPage} />
          <Route path="/weekly" component={WeeklyPage} />
          <Route path="/history" component={HistoryPage} />
          <Route path="/home" component={HomeModulePage} />
          <Route path="/review" component={ReviewPage} />
          <Route path="/areas" component={AreasPage} />
          {/* Legacy alias: /pillars was the previous name. Keep it routable so
              old bookmarks, links, and shared URLs don't 404. */}
          <Route path="/pillars" component={AreasPage} />
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
