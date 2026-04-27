import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import { isClerkEnabled } from "@/lib/clerk-config";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { useListPillars } from "@workspace/api-client-react";
import { useMe, shouldShowWizard } from "@/data/onboarding";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsCheatsheet } from "@/components/shortcuts-cheatsheet";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const WeeklyPage = lazy(() => import("@/pages/weekly"));
const HistoryPage = lazy(() => import("@/pages/history"));
const ReviewPage = lazy(() => import("@/pages/review"));
const PillarsPage = lazy(() => import("@/pages/pillars"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const HomeModulePage = lazy(() => import("@/pages/home-module"));
const NotFound = lazy(() => import("@/pages/not-found"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const SignUpPage = lazy(() => import("@/pages/sign-up"));
const WelcomePage = lazy(() => import("@/pages/welcome"));

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function SettingsRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/pillars", { replace: true });
  }, [navigate]);
  return <RouteFallback />;
}

function FirstRunGuard() {
  const [location, navigate] = useLocation();
  const meQuery = useMe();
  const pillarsQuery = useListPillars();

  const isLoading = meQuery.isLoading || pillarsQuery.isLoading;
  const eligible = shouldShowWizard({
    user: meQuery.data,
    pillarCount: pillarsQuery.data?.length,
    isLoading,
  });

  useEffect(() => {
    if (eligible && location !== "/welcome") {
      navigate("/welcome", { replace: true });
    }
  }, [eligible, location, navigate]);

  return null;
}

function ProtectedAppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/welcome" component={WelcomePage} />
        <Route>
          <FirstRunGuard />
          <Layout>
            <Suspense fallback={<RouteFallback />}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/weekly" component={WeeklyPage} />
                <Route path="/pillars" component={PillarsPage} />
                <Route path="/history" component={HistoryPage} />
                <Route path="/profile" component={ProfilePage} />
                {/* Secondary routes — kept accessible but not in primary nav */}
                <Route path="/review" component={ReviewPage} />
                <Route path="/home" component={HomeModulePage} />
                {/* Back-compat: /settings → /pillars (Phase 6 will remove). */}
                <Route path="/settings" component={SettingsRedirect} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function Router() {
  // Clerk-mode: render sign-in / sign-up routes publicly; gate everything
  // else behind <SignedIn>/<SignedOut>. Owner-mode: skip the gate entirely.
  if (!isClerkEnabled()) {
    return <ProtectedAppRoutes />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/sign-in/:rest*" component={SignInPage} />
        <Route path="/sign-up/:rest*" component={SignUpPage} />
        <Route>
          <SignedIn>
            <ProtectedAppRoutes />
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </Route>
      </Switch>
    </Suspense>
  );
}

const rawBase = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");

function GlobalShortcuts() {
  useKeyboardShortcuts();
  return <ShortcutsCheatsheet />;
}

function App() {
  const routerTree = (
    <>
      <GlobalShortcuts />
      <Router />
    </>
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        {rawBase ? (
          <WouterRouter base={rawBase}>{routerTree}</WouterRouter>
        ) : (
          routerTree
        )}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
