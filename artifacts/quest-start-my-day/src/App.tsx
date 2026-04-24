import { Switch, Route, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import TodayPage from "@/pages/today";
import WeeklyPage from "@/pages/weekly";
import HistoryPage from "@/pages/history";
import ReviewPage from "@/pages/review";
import SettingsPage from "@/pages/settings";
import HomeModulePage from "@/pages/home-module";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/today" component={TodayPage} />
        <Route path="/weekly" component={WeeklyPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/home" component={HomeModulePage} />
        <Route path="/review" component={ReviewPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
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
