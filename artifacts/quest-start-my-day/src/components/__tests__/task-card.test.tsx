import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// TaskCard pulls in mutation hooks + query client; for static rendering
// of the goal chip we just need the hooks to be no-ops so the component
// can render to HTML without a QueryClientProvider.
const noopMutation = { mutate: vi.fn(), isPending: false };
vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@workspace/api-client-react");
  return {
    ...actual,
    useUpdateTask: () => noopMutation,
    useDeleteTask: () => noopMutation,
    useStepBackTask: () => noopMutation,
    useListAreas: () => ({ data: [] }),
    useListMilestones: () => ({ data: [] }),
  };
});
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

import { TaskCard, type TaskCardGoal } from "../task-card";
import { TooltipProvider } from "../ui/tooltip";

const wrap = (ui: React.ReactNode) =>
  renderToStaticMarkup(<TooltipProvider>{ui}</TooltipProvider>);

const baseTask = {
  id: 1,
  title: "Write the onboarding script",
  category: "Deep work",
  status: "pending",
  date: "2026-05-05",
  areaId: 7,
  milestoneId: 42,
};

describe("TaskCard goal chip", () => {
  it("renders chip with link to /areas/{areaId}#goal-{goalId} when goalMap has the milestone", () => {
    const goalMap = new Map<number, TaskCardGoal>([
      [42, { id: 42, title: "Ideal client defined", areaId: 7 }],
    ]);
    const html = wrap(
      <TaskCard task={baseTask} date="2026-05-05" goalMap={goalMap} />,
    );
    expect(html).toContain('data-testid="task-goal-chip-1"');
    expect(html).toContain('href="/areas/7#goal-42"');
    expect(html).toContain("Ideal client defined");
  });

  it("does not render chip when milestoneId is null", () => {
    const goalMap = new Map<number, TaskCardGoal>([
      [42, { id: 42, title: "Ideal client defined", areaId: 7 }],
    ]);
    const html = wrap(
      <TaskCard task={{ ...baseTask, milestoneId: null }} date="2026-05-05" goalMap={goalMap} />,
    );
    expect(html).not.toContain('data-testid="task-goal-chip-1"');
  });

  it("does not render chip when goalMap has no entry for the milestone", () => {
    const html = wrap(
      <TaskCard task={baseTask} date="2026-05-05" goalMap={new Map()} />,
    );
    expect(html).not.toContain('data-testid="task-goal-chip-1"');
  });
});
