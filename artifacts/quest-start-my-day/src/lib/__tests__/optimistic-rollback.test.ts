import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// This test verifies the optimistic-update pattern used across mutations
// (Dashboard priority buttons, weekly toggle, task-card status):
//   - onMutate snapshots the previous cache + writes the optimistic value
//   - onError rolls back to the snapshot
//   - onSettled is a no-op for cache content (would invalidate in real code)

interface TaskRow {
  id: number;
  status: "pending" | "done";
}

const QUERY_KEY = ["tasks", { date: "2026-04-27" }];

function runMutationWithRollback(
  client: QueryClient,
  taskId: number,
  nextStatus: TaskRow["status"],
  shouldFail: boolean,
): { prev: unknown } {
  // onMutate
  const prev = client.getQueryData(QUERY_KEY);
  client.setQueryData(QUERY_KEY, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return (old as TaskRow[]).map(t => (t.id === taskId ? { ...t, status: nextStatus } : t));
  });

  if (shouldFail) {
    // onError
    client.setQueryData(QUERY_KEY, prev);
  }

  return { prev };
}

describe("optimistic mutation rollback", () => {
  it("writes the optimistic value and rolls back on error", () => {
    const client = new QueryClient();
    const initial: TaskRow[] = [
      { id: 1, status: "pending" },
      { id: 2, status: "pending" },
    ];
    client.setQueryData(QUERY_KEY, initial);

    runMutationWithRollback(client, 1, "done", true);

    const after = client.getQueryData<TaskRow[]>(QUERY_KEY);
    expect(after).toBeDefined();
    expect(after![0]!.status).toBe("pending");
    expect(after![1]!.status).toBe("pending");
    expect(after).toStrictEqual(initial);
  });

  it("keeps the optimistic value on success (no rollback)", () => {
    const client = new QueryClient();
    const initial: TaskRow[] = [
      { id: 1, status: "pending" },
      { id: 2, status: "pending" },
    ];
    client.setQueryData(QUERY_KEY, initial);

    runMutationWithRollback(client, 2, "done", false);

    const after = client.getQueryData<TaskRow[]>(QUERY_KEY);
    expect(after).toBeDefined();
    expect(after![0]!.status).toBe("pending");
    expect(after![1]!.status).toBe("done");
  });
});
