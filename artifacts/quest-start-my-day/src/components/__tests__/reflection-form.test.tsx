import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReflectionForm, type ReflectionValues } from "../reflection-form";

const empty: ReflectionValues = {
  moved: "",
  stuck: "",
  drop: "",
  nextFocus: "",
};

describe("ReflectionForm", () => {
  it("renders the four unified labels at week cadence", () => {
    const html = renderToStaticMarkup(
      <ReflectionForm cadence="week" value={empty} onSave={vi.fn()} />,
    );
    expect(html).toContain("Moved");
    expect(html).toContain("Stuck");
    expect(html).toContain("Drop");
    expect(html).toContain("Next focus");
  });

  it("renders the four unified labels at month cadence", () => {
    const html = renderToStaticMarkup(
      <ReflectionForm cadence="month" value={empty} onSave={vi.fn()} />,
    );
    expect(html).toContain("Moved");
    expect(html).toContain("Stuck");
    expect(html).toContain("Drop");
    expect(html).toContain("Next focus");
  });

  it("uses cadence-prefixed input ids", () => {
    const weeklyHtml = renderToStaticMarkup(
      <ReflectionForm cadence="week" value={empty} onSave={vi.fn()} />,
    );
    expect(weeklyHtml).toContain('id="weekly-reflection-moved"');
    expect(weeklyHtml).toContain('id="weekly-reflection-nextFocus"');

    const monthlyHtml = renderToStaticMarkup(
      <ReflectionForm cadence="month" value={empty} onSave={vi.fn()} />,
    );
    expect(monthlyHtml).toContain('id="monthly-reflection-moved"');
    expect(monthlyHtml).toContain('id="monthly-reflection-nextFocus"');
  });
});
