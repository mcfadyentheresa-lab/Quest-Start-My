import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReflectionForm, type ReflectionValues } from "../reflection-form";

const empty: ReflectionValues = {
  moved: "",
  stuck: "",
  drop: "",
  nextFocus: "",
};

describe("ReflectionForm (static)", () => {
  it("renders the four unified labels at week cadence", () => {
    const html = renderToStaticMarkup(
      <ReflectionForm cadence="week" value={empty} onSave={vi.fn()} periodKey="2026-04-27" />,
    );
    expect(html).toContain("Moved");
    expect(html).toContain("Stuck");
    expect(html).toContain("Drop");
    expect(html).toContain("Next focus");
  });

  it("renders the four unified labels at month cadence", () => {
    const html = renderToStaticMarkup(
      <ReflectionForm cadence="month" value={empty} onSave={vi.fn()} periodKey="2026-04" />,
    );
    expect(html).toContain("Moved");
    expect(html).toContain("Stuck");
    expect(html).toContain("Drop");
    expect(html).toContain("Next focus");
  });

  it("uses cadence-prefixed input ids", () => {
    const weeklyHtml = renderToStaticMarkup(
      <ReflectionForm cadence="week" value={empty} onSave={vi.fn()} periodKey="2026-04-27" />,
    );
    expect(weeklyHtml).toContain('id="weekly-reflection-moved"');
    expect(weeklyHtml).toContain('id="weekly-reflection-nextFocus"');

    const monthlyHtml = renderToStaticMarkup(
      <ReflectionForm cadence="month" value={empty} onSave={vi.fn()} periodKey="2026-04" />,
    );
    expect(monthlyHtml).toContain('id="monthly-reflection-moved"');
    expect(monthlyHtml).toContain('id="monthly-reflection-nextFocus"');
  });

  it("renders a Regenerate button", () => {
    const html = renderToStaticMarkup(
      <ReflectionForm cadence="week" value={empty} onSave={vi.fn()} periodKey="2026-04-27" />,
    );
    expect(html).toContain("Regenerate");
  });
});

describe("ReflectionForm (live)", () => {
  let container: HTMLElement;
  let root: Root;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("calls the weekly draft endpoint on mount when value is empty", async () => {
    const draftBody = JSON.stringify({
      moved: "Closed three things.",
      stuck: "One blocked.",
      drop: "Drop the side quest.",
      nextFocus: "Aster & Spruce stays the headline.",
      source: "rules",
      generatedAt: "2026-04-28T09:00:00.000Z",
    });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(draftBody, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await act(async () => {
      root.render(
        <ReflectionForm
          cadence="week"
          value={empty}
          onSave={vi.fn()}
          periodKey="2026-04-27"
        />,
      );
    });
    // Wait for the draft fetch to resolve and state to settle.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    const calls = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const [url, init] = calls[0]!;
    expect(String(url)).toContain("/reflections/weekly/draft");
    expect(init?.method).toBe("POST");

    // Field pre-filled.
    const moved = container.querySelector<HTMLTextAreaElement>("#weekly-reflection-moved");
    expect(moved?.value).toBe("Closed three things.");

    // Provenance badge present after draft load.
    const provenance = container.querySelector('[data-testid="reflection-provenance"]');
    expect(provenance).not.toBeNull();
    expect(provenance?.textContent ?? "").toMatch(/Drafted from your activity/);
  });

  it("does not draft when value is non-empty", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await act(async () => {
      root.render(
        <ReflectionForm
          cadence="week"
          value={{ moved: "saved", stuck: "", drop: "", nextFocus: "" }}
          onSave={vi.fn()}
          periodKey="2026-04-27"
        />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    // Read-only "Edit" link should be present.
    expect(container.querySelector('[data-testid="reflection-edit"]')).not.toBeNull();
  });
});
