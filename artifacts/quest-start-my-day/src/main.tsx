import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Visible error boundary so production crashes are never silent.
interface ErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

class VisibleErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console AND update state with details
    // eslint-disable-next-line no-console
    console.error("[App crash]", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: "24px",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "#fee2e2",
          color: "#7f1d1d",
          minHeight: "100vh",
          boxSizing: "border-box",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          <h1 style={{ margin: "0 0 12px", fontSize: "20px" }}>App crashed during render</h1>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {String(this.state.error.name)}: {String(this.state.error.message)}
          </div>
          <details open>
            <summary>Stack trace</summary>
            <pre style={{ fontSize: "12px" }}>{String(this.state.error.stack)}</pre>
          </details>
          {this.state.info?.componentStack && (
            <details open>
              <summary>Component stack</summary>
              <pre style={{ fontSize: "12px" }}>{this.state.info.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Also catch anything that happens outside React (bundle errors, top-level throws)
window.addEventListener("error", (e) => {
  // eslint-disable-next-line no-console
  console.error("[window.error]", e.error || e.message);
  renderFallback("window.error", e.error || new Error(String(e.message)));
});
window.addEventListener("unhandledrejection", (e) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledrejection]", e.reason);
  renderFallback("unhandledrejection", e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
});

function renderFallback(kind: string, err: Error) {
  const root = document.getElementById("root");
  if (!root || root.dataset["crashed"] === "1") return;
  // Only render fallback if React hasn't already rendered something
  if (root.childElementCount > 0) return;
  root.dataset["crashed"] = "1";
  root.innerHTML = `
    <div style="padding:24px;font-family:ui-monospace,Menlo,monospace;background:#fee2e2;color:#7f1d1d;min-height:100vh;box-sizing:border-box;white-space:pre-wrap;word-break:break-word;">
      <h1 style="margin:0 0 12px;font-size:20px;">App startup error (${kind})</h1>
      <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(err.name)}: ${escapeHtml(err.message)}</div>
      <pre style="font-size:12px;">${escapeHtml(err.stack || "")}</pre>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

try {
  createRoot(document.getElementById("root")!).render(
    <VisibleErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </VisibleErrorBoundary>
  );
} catch (err) {
  renderFallback("createRoot", err instanceof Error ? err : new Error(String(err)));
}
