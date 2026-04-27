import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Sparkles, Check, ExternalLink, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { isBillingEnabled } from "@/lib/billing-config";

interface PlanUsage {
  plan: "free" | "pro";
  pillars: { used: number; limit: number | null };
  tasks: { used: number; limit: number | null };
  canExport: boolean;
  bypassed: boolean;
}

function formatLimit(used: number, limit: number | null): string {
  if (limit === null) return `${used} (unlimited)`;
  return `${used} of ${limit} used`;
}

export default function BillingPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"monthly" | "yearly" | "portal" | null>(null);

  useEffect(() => {
    if (!isBillingEnabled()) {
      navigate("/profile", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await customFetch<PlanUsage>("/api/billing/usage", { method: "GET" });
        if (!cancelled) setUsage(data);
      } catch {
        if (!cancelled) {
          toast({
            title: "Couldn't load billing details",
            description: "Try refreshing in a moment.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  if (!isBillingEnabled()) return null;

  async function startCheckout(priceId: "monthly" | "yearly") {
    setPending(priceId);
    try {
      const { url } = await customFetch<{ url: string | null }>("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("Stripe did not return a checkout URL.");
      }
    } catch (err) {
      toast({
        title: "Couldn't start checkout",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  }

  async function openPortal() {
    setPending("portal");
    try {
      const { url } = await customFetch<{ url: string }>("/api/billing/portal", {
        method: "POST",
      });
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Couldn't open billing portal",
        description: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  }

  const isPro = usage?.plan === "pro";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-serif text-2xl font-medium text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your plan and subscription</p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-card-border p-5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Current plan</p>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : usage ? (
          <>
            <div className="flex items-baseline gap-2">
              <p className="font-serif text-2xl font-medium text-foreground capitalize">{usage.plan}</p>
              {isPro && <span className="text-xs text-violet-600 dark:text-violet-400">— unlimited</span>}
            </div>
            <div className="space-y-1 text-sm text-foreground">
              <p>Pillars: {formatLimit(usage.pillars.used, usage.pillars.limit)}</p>
              <p>Active tasks: {formatLimit(usage.tasks.used, usage.tasks.limit)}</p>
              <p>CSV export: {usage.canExport ? "available" : "Pro only"}</p>
            </div>
            {usage.bypassed && (
              <p className="text-xs text-muted-foreground italic">
                Plan limits are not enforced in this environment.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not available.</p>
        )}
      </motion.section>

      {!isPro && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-card-border p-5 space-y-4"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Upgrade to Pro</p>
            <p className="text-sm text-foreground">
              Unlock unlimited pillars, unlimited tasks, and CSV export.
            </p>
          </div>
          <ul className="space-y-1.5 text-sm text-foreground">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-violet-600" /> Unlimited pillars</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-violet-600" /> Unlimited active tasks</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-violet-600" /> CSV export</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() => startCheckout("monthly")}
              disabled={pending !== null}
              className="rounded-xl gap-1.5"
              data-testid="upgrade-monthly"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {pending === "monthly" ? "Starting…" : "Upgrade — $9 / month"}
            </Button>
            <Button
              onClick={() => startCheckout("yearly")}
              disabled={pending !== null}
              variant="outline"
              className="rounded-xl gap-1.5"
              data-testid="upgrade-yearly"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {pending === "yearly" ? "Starting…" : "Upgrade — $84 / year"}
            </Button>
          </div>
        </motion.section>
      )}

      {isPro && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-card-border p-5 space-y-3"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Manage subscription</p>
          <p className="text-sm text-foreground">
            Update your payment method, change plans, or cancel.
          </p>
          <Button
            onClick={openPortal}
            disabled={pending !== null}
            variant="outline"
            className="rounded-xl gap-1.5"
            data-testid="open-portal"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {pending === "portal" ? "Opening…" : "Open billing portal"}
          </Button>
        </motion.section>
      )}
    </div>
  );
}
