import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTheme } from "next-themes";
import { Sun, Moon, LayoutDashboard, Calendar, CalendarDays, History, Settings, BookOpen, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FocusTimerHeaderPill } from "@/components/focus-timer-header-pill";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/weekly", label: "This Week", icon: Calendar },
  { href: "/history", label: "History", icon: History },
  { href: "/home", label: "Home", icon: Home },
  { href: "/review", label: "Month", icon: BookOpen },
  { href: "/areas", label: "Areas", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" aria-label="Quest — your quiet chief of staff">
            <div className="flex items-baseline gap-2 cursor-pointer">
              <span className="font-serif text-lg font-medium text-foreground tracking-tight">Quest</span>
              <span className="text-muted-foreground text-xs italic hidden sm:inline">your quiet chief of staff</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <FocusTimerHeaderPill />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 rounded-full"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom navigation (mobile-first)
          Touch targets meet WCAG 2.5.5 / Apple HIG minimum 44x44px even
          on a 360px viewport with 7 items. */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border" aria-label="Primary">
        <div className="max-w-2xl mx-auto flex items-stretch justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href} className="flex-1 min-w-0">
                <button
                  type="button"
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full min-h-[56px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.2px]" : "stroke-[1.7px]"}`} />
                  <span className="text-[10px] font-medium leading-none truncate max-w-full">{label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
