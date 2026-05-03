/**
 * /sign-in page.
 *
 * Single-tenant shared-secret auth (see api-server/src/lib/auth.ts).
 * The form posts the token to /api/auth/sign-in; on success the server
 * sets the quest_session cookie and we redirect to ?next or /today.
 *
 * No sign-up flow, no password reset — this is just a way out of the
 * DevTools-fetch dance the owner had to do every time the cookie expired.
 *
 * Layout note: this page is rendered OUTSIDE the main app chrome (see
 * App.tsx) — no top nav, no bottom tab bar, no Inbox composer pill. Just
 * a centered card on the background.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function nextPathFromQuery(): string {
  if (typeof window === "undefined") return "/today";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("next");
  // Only allow same-origin, absolute-path destinations to avoid
  // open-redirect to /sign-in?next=https://evil.example.com.
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/today";
  return raw;
}

export default function SignInPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus on load. iOS sometimes ignores autofocus on password
  // inputs, so we do it imperatively after mount.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (res.status === 204) {
        // Hard navigation so React Query caches start fresh with the
        // new identity. Avoids stale "no data" states bleeding across
        // sign-out/sign-in boundaries.
        window.location.assign(nextPathFromQuery());
        return;
      }
      if (res.status === 401) {
        setError("That token didn't match. Try again.");
      } else if (res.status === 503) {
        setError("Sign-in isn't configured on this server.");
      } else {
        setError(`Sign-in failed (${res.status}). Try again in a moment.`);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      // Reselect the field so the user can correct without re-clicking.
      requestAnimationFrame(() => inputRef.current?.select());
    }
  };

  // If the user lands here while already signed in, bounce them home.
  // Cheap probe: /api/auth/me returns 200 when the cookie is good.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.status === 200) navigate(nextPathFromQuery(), { replace: true });
      })
      .catch(() => {
        // Network noise on this probe is fine — they'll just see the form.
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground tracking-tight">
            Quest
          </h1>
          <p className="text-muted-foreground text-sm italic mt-1">
            your quiet chief of staff
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-card-border bg-card p-6 space-y-4 shadow-sm"
          aria-labelledby="sign-in-heading"
        >
          <div>
            <h2
              id="sign-in-heading"
              className="font-serif text-base font-medium text-foreground"
            >
              Sign in
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your access token to continue.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sign-in-token"
              className="text-xs font-medium text-muted-foreground"
            >
              Access token
            </label>
            <input
              ref={inputRef}
              id="sign-in-token"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (error) setError(null);
              }}
              disabled={submitting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-input disabled:opacity-60"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "sign-in-error" : undefined}
            />
          </div>

          {error && (
            <p
              id="sign-in-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!token.trim() || submitting}
            className="w-full rounded-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
