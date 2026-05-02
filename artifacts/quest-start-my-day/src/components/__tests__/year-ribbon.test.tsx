import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { YearRibbonView } from "../year-ribbon";
import type { YearRibbonResponse } from "@workspace/api-client-react";

function emptyWeeks() {
  return Array.from({ length: 52 }, (_, i) => ({
    index: i,
    completedTasks: 0,
    createdTasks: 0,
    closedSteps: 0,
  }));
}

function makeData(over: Partial<YearRibbonResponse> = {}): YearRibbonResponse {
  const weeks = emptyWeeks();
  weeks[10] = { ...weeks[10]!, completedTasks: 2, closedSteps: 1 };
  return {
    year: 2026,
    weeks: 52,
    todayWeekIndex: 18,
    areas: [
      {
        id: 1,
        name: "Aster & Spruce",
        priority: "P1",
        color: "#7d8a6f",
        category: "business",
        weeks,
        goalBars: [],
      },
    ],
    ...over,
  };
}

describe("YearRibbonView", () => {
  it("renders the area name, priority chip, and 52 cells", () => {
    const html = renderToStaticMarkup(
      <YearRibbonView
        data={makeData()}
        year={2026}
        onYear={() => {}}
        onToday={() => {}}
      />,
    );
    expect(html).toContain("Aster &amp; Spruce");
    expect(html).toContain("P1");
    // 52 cells per area row
    const cellMatches = html.match(/data-testid="year-cell-1-/g) ?? [];
    expect(cellMatches.length).toBe(52);
  });

  it("rings today's week and marks future weeks as muted", () => {
    const data = makeData({ todayWeekIndex: 18 });
    const html = renderToStaticMarkup(
      <YearRibbonView
        data={data}
        year={2026}
        onYear={() => {}}
        onToday={() => {}}
      />,
    );
    expect(html).toContain('data-testid="year-cell-1-18" data-future="false" data-today="true"');
    expect(html).toContain('data-testid="year-cell-1-19" data-future="true" data-today="false"');
    expect(html).toContain('data-testid="year-cell-1-17" data-future="false" data-today="false"');
  });

  it("renders a goal bar across the cells where the goal had activity", () => {
    const data = makeData({
      areas: [
        {
          id: 1,
          name: "Site",
          priority: "P1",
          color: "#7d8a6f",
          category: "business",
          weeks: emptyWeeks().map((w, i) =>
            i >= 8 && i <= 16 ? { ...w, completedTasks: 2, closedSteps: 1 } : w,
          ),
          goalBars: [
            { goalId: 12, title: "Site rebuild", startWeek: 8, endWeek: 16, status: "active", isOnHold: false },
          ],
        },
      ],
    });
    const html = renderToStaticMarkup(
      <YearRibbonView
        data={data}
        year={2026}
        onYear={() => {}}
        onToday={() => {}}
      />,
    );
    expect(html).toContain('data-testid="goal-bar-12"');
    expect(html).toContain("Site rebuild");
  });

  it("falls back to the quiet-year empty state when activity is zero", () => {
    const dataNoActivity: YearRibbonResponse = {
      year: 2026,
      weeks: 52,
      todayWeekIndex: 18,
      areas: [
        {
          id: 1,
          name: "Aster",
          priority: "P1",
          color: null,
          category: null,
          weeks: emptyWeeks(),
          goalBars: [],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <YearRibbonView
        data={dataNoActivity}
        year={2026}
        onYear={() => {}}
        onToday={() => {}}
      />,
    );
    expect(html).toContain("Quiet year so far");
  });

  it("falls back to the no-areas empty state when there are zero areas", () => {
    const html = renderToStaticMarkup(
      <YearRibbonView
        data={makeData({ areas: [] })}
        year={2026}
        onYear={() => {}}
        onToday={() => {}}
      />,
    );
    expect(html).toContain("No areas yet");
  });
});
