import { useLocation, Link } from "wouter";
import { useTheme } from "next-themes";
import { Sun, Moon, LayoutDashboard, Calendar, History, User, Sprout } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/lib/clerk-config";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/weekly", label: "This Week", icon: Calendar },
  { href: "/pillars", label: "Pillars", icon: Sprout },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-medium text-foreground tracking-tight">Quest</span>
            <span className="text-muted-foreground text-sm hidden sm:inline">Start My Day</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 rounded-full"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {isClerkEnabled() ? <UserButton afterSignOutUrl="/sign-in" /> : null}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-2xl mx-auto flex items-center justify-around py-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <button
                  type="button"
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon aria-hidden="true" className={`h-5 w-5 ${isActive ? "stroke-[2.2px]" : "stroke-[1.7px]"}`} />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
