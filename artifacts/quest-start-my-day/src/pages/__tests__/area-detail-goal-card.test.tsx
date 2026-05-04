import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoalCard } from "../area-detail";
import type { Milestone, Task } from "@workspace/api-client-react";

const noop = vi.fn();
const asyncNoop = vi.fn(async () => {});

function makeGoal(over: Record<string, unknown>): Milestone {
  return {
    id: 0,
    areaId: 1,
    title: "",
    status: "active",
    sortOrder: 0,
    mode: "ordered",
    isOnHold: false,
    holdUntilMilestoneId: null,
    completedAt: null,
    createdAt: "2026-04-01T00:00:00Z",
    ...over,
  } as Milestone;
}

function makeTask(over: Record<string, unknown>): Task {
  return {
    id: 0,
    title: "",
    category: "business",
    status: "pending",
    areaId: 1,
    milestoneId: 1,
    date: "2026-04-28",
    createdAt: "2026-04-01T00:00:00Z",
    sortOrder: 0,
    ...over,
  } as Task;
}

describe("GoalCard — held state", () => {
  it("renders muted, shows On hold pill, and collapses steps", () => {
    const goal = makeGoal({
      id: 2,
      title: "Phase 2",
      isOnHold: true,
      holdUntilMilestoneId: 1,
    });
    const siblings = [makeGoal({ id: 1, title: "Phase 1" })];
    const tasks: Task[] = [
      makeTask({ id: 10, milestoneId: 2, title: "Step A", sortOrder: 0 }),
      makeTask({ id: 11, milestoneId: 2, title: "Step B", sortOrder: 1 }),
    ];

    const html = renderToStaticMarkup(
      <GoalCard
        goal={goal}
        tasks={tasks}
        siblings={siblings}
        onUpdateTask={noop}
        onAfterMutation={noop}
        breakdownPending={false}
        onBreakdown={asyncNoop}
        onAddStep={asyncNoop}
        onBulkAddSteps={asyncNoop}
        onReorderSteps={asyncNoop}
        onUpdateStepTitle={asyncNoop}
        onDeleteStep={asyncNoop}
        onToggleMode={asyncNoop}
        onDeleteGoal={asyncNoop}
        onSetCompleted={asyncNoop}
        onSetHoldUntil={asyncNoop}
        onUpdateNotes={asyncNoop}
      />,
    );

    expect(html).toMatch(/opacity-60/);
    expect(html).toMatch(/shadow-none/);
    expect(html).toMatch(/On hold/);
    expect(html).toMatch(/Phase 1/);
    expect(html).toMatch(/2 steps — show/);
    expect(html).not.toMatch(/Step A/);
    expect(html).not.toMatch(/Step B/);
  });

  it("renders normally when not held", () => {
    const goal = makeGoal({ id: 2, title: "Phase 2" });
    const html = renderToStaticMarkup(
      <GoalCard
        goal={goal}
        tasks={[]}
        siblings={[]}
        onUpdateTask={noop}
        onAfterMutation={noop}
        breakdownPending={false}
        onBreakdown={asyncNoop}
        onAddStep={asyncNoop}
        onBulkAddSteps={asyncNoop}
        onReorderSteps={asyncNoop}
        onUpdateStepTitle={asyncNoop}
        onDeleteStep={asyncNoop}
        onToggleMode={asyncNoop}
        onDeleteGoal={asyncNoop}
        onSetCompleted={asyncNoop}
        onSetHoldUntil={asyncNoop}
        onUpdateNotes={asyncNoop}
      />,
    );
    expect(html).not.toMatch(/opacity-60/);
    expect(html).not.toMatch(/On hold/);
  });
});
