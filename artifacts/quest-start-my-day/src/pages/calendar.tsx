import { lazy, Suspense, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { CalendarDays, Calendar as CalendarIcon, BookOpen, History as HistoryIcon } from "lucide-react";

const DayView = lazy(() => import("@/pages/day-plan"));
const WeekView = lazy(() => import("@/pages/weekly"));
const MonthView = lazy(() => import("@/pages/review"));
const HistoryView = lazy(() => import("@/pages/history"));

type CalendarView = "day" | "week" | "month" | "history";

const VIEWS: { id: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { id: "day", label: "Day", icon: CalendarDays },
  { id: "week", label: "Week", icon: CalendarIcon },
  { id: "month", label: "Month", icon: BookOpen },
  { id: "history", label: "History", icon: HistoryIcon },
];

function parseView(raw: string | null): CalendarView {
  if (raw === "day" || raw === "week" || raw === "month" || raw === "history") return raw;
  return "week";
}

function ViewFallback() {
  return (
    <div className="flex h-full min-h-[40vh] w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export default function CalendarPage() {
  const search = useSearch();
  const [, navigate] = useLocation();

  const view = useMemo(() => parseView(new URLSearchParams(search).get("view")), [search]);

  // If the URL had no view param, normalize to ?view=week so deep-links share cleanly.
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (!params.get("view")) {
      navigate(`/calendar?view=${view}`, { replace: true });
    }
  }, [search, view, navigate]);

  const setView = (next: CalendarView) => {
    if (next === view) return;
    navigate(`/calendar?view=${next}`, { replace: true });
  };

  return (
    <div className="space-y-4">
      <nav
        aria-label="Calendar view"
        className="rounded-2xl bg-card border border-card-border p-1 grid grid-cols-4 gap-1"
      >
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = id === view;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={active}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? "stroke-[2.2px]" : "stroke-[1.7px]"}`} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <Suspense fallback={<ViewFallback />}>
        {view === "day" && <DayView />}
        {view === "week" && <WeekView />}
        {view === "month" && <MonthView />}
        {view === "history" && <HistoryView />}
      </Suspense>
    </div>
  );
}
