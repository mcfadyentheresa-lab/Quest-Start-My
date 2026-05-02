import { describe, expect, it, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import { setBreakdownChatClient } from "../../lib/breakdown/ai";

// Drives the same in-memory pattern as milestones-bulk-steps.test.ts:
// Drizzle's table refs become tagged objects, drizzle-orm helpers capture
// (column, value) pairs, and the mocked db chain reads/writes against
// fixtures.
type Milestone = { id: number; areaId: number; title: string; description: string | null };
type Area = {
  id: number;
  name: string;
  description: string | null;
  priority: string;
  isActiveThisWeek: boolean;
};
type Task = {
  id: number;
  title: string;
  category: string;
  status: string;
  areaId: number | null;
  milestoneId: number | null;
  date: string;
  createdAt: Date;
  parentTaskId: number | null;
  stepBackDepth: number;
  blockerType: string | null;
  adjustmentType: string | null;
  adjustmentReason: string | null;
  taskSource: string | null;
  sortOrder: number;
  whyItMatters: string | null;
  doneLooksLike: string | null;
  suggestedNextStep: string | null;
  blockerReason: string | null;
};

const fixtures: {
  milestones: Milestone[];
  areas: Area[];
  tasks: Task[];
  nextTaskId: number;
} = {
  milestones: [],
  areas: [],
  tasks: [],
  nextTaskId: 1,
};

const MILESTONES = Symbol("milestonesTable");
const TASKS = Symbol("tasksTable");
const AREAS = Symbol("areasTable");
const COL_MILESTONES_ID = Symbol("milestones.id");
const COL_TASKS_MILESTONE_ID = Symbol("tasks.milestoneId");
const COL_TASKS_AREA_ID = Symbol("tasks.areaId");
const COL_TASKS_STATUS = Symbol("tasks.status");
const COL_AREAS_ID = Symbol("areas.id");

vi.mock("@workspace/db", () => {
  const milestonesTable = {
    [Symbol.for("table")]: MILESTONES,
    id: COL_MILESTONES_ID,
    areaId: "areaId",
  } as Record<string | symbol, unknown>;
  const tasksTable = {
    [Symbol.for("table")]: TASKS,
    id: "id",
    milestoneId: COL_TASKS_MILESTONE_ID,
    areaId: COL_TASKS_AREA_ID,
    status: COL_TASKS_STATUS,
    sortOrder: "sortOrder",
    title: "title",
    createdAt: "createdAt",
  } as Record<string | symbol, unknown>;
  const areasTable = {
    [Symbol.for("table")]: AREAS,
    id: COL_AREAS_ID,
    name: "name",
    description: "description",
    priority: "priority",
    isActiveThisWeek: "isActiveThisWeek",
  } as Record<string | symbol, unknown>;

  function selectBuilder(_columns?: unknown) {
    let table: symbol | null = null;
    const wherePreds: { col: symbol; value: unknown }[] = [];
    let limitN: number | null = null;

    const builder = {
      from(t: typeof milestonesTable | typeof tasksTable | typeof areasTable) {
        table = t[Symbol.for("table")] as symbol;
        return builder;
      },
      where(predicate: { col: symbol; value: unknown } | { preds: { col: symbol; value: unknown }[] } | undefined) {
        if (!predicate) return builder;
        if ("preds" in predicate) {
          for (const p of predicate.preds) wherePreds.push(p);
        } else {
          wherePreds.push(predicate);
        }
        return builder;
      },
      orderBy() {
        return builder;
      },
      limit(n: number) {
        limitN = n;
        return builder;
      },
      then(resolve: (rows: unknown[]) => unknown) {
        const rows = run();
        return Promise.resolve(rows).then(resolve);
      },
    };

    function matches<T extends Record<string, unknown>>(row: T, predCol: symbol, predValue: unknown, mapping: Record<symbol, keyof T>): boolean {
      const key = mapping[predCol];
      if (!key) return true;
      return row[key] === predValue;
    }

    function run(): unknown[] {
      if (table === MILESTONES) {
        const mapping = { [COL_MILESTONES_ID]: "id" } as Record<symbol, keyof Milestone>;
        let rows: Milestone[] = fixtures.milestones;
        for (const p of wherePreds) {
          rows = rows.filter((r) => matches(r, p.col, p.value, mapping));
        }
        return rows;
      }
      if (table === TASKS) {
        const mapping = {
          [COL_TASKS_MILESTONE_ID]: "milestoneId",
          [COL_TASKS_AREA_ID]: "areaId",
          [COL_TASKS_STATUS]: "status",
        } as Record<symbol, keyof Task>;
        let rows: Task[] = fixtures.tasks;
        for (const p of wherePreds) {
          rows = rows.filter((r) => matches(r, p.col, p.value, mapping));
        }
        if (limitN !== null) rows = rows.slice(0, limitN);
        return rows;
      }
      if (table === AREAS) {
        const mapping = { [COL_AREAS_ID]: "id" } as Record<symbol, keyof Area>;
        let rows: Area[] = fixtures.areas;
        for (const p of wherePreds) {
          rows = rows.filter((r) => matches(r, p.col, p.value, mapping));
        }
        return rows;
      }
      return [];
    }

    return builder;
  }

  function insertBuilder(t: typeof milestonesTable | typeof tasksTable | typeof areasTable) {
    const table = t[Symbol.for("table")] as symbol;
    let pendingValues: Record<string, unknown>[] = [];
    const builder = {
      values(rows: Record<string, unknown> | Record<string, unknown>[]) {
        pendingValues = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      returning(): Promise<unknown[]> {
        if (table === TASKS) {
          const created = pendingValues.map((row) => ({
            id: fixtures.nextTaskId++,
            title: String(row["title"] ?? ""),
            category: String(row["category"] ?? "business"),
            status: String(row["status"] ?? "pending"),
            areaId: (row["areaId"] as number | null | undefined) ?? null,
            milestoneId: (row["milestoneId"] as number | null | undefined) ?? null,
            date: String(row["date"] ?? ""),
            createdAt: new Date("2026-05-01T00:00:00Z"),
            parentTaskId: null,
            stepBackDepth: 0,
            blockerType: null,
            adjustmentType: null,
            adjustmentReason: null,
            taskSource: null,
            sortOrder: Number(row["sortOrder"] ?? 0),
            whyItMatters: null,
            doneLooksLike: null,
            suggestedNextStep: null,
            blockerReason: null,
          }));
          fixtures.tasks.push(...(created as Task[]));
          return Promise.resolve(created);
        }
        return Promise.resolve([]);
      },
    };
    return builder;
  }

  return {
    db: {
      select: (cols?: unknown) => selectBuilder(cols),
      insert: (t: typeof milestonesTable | typeof tasksTable | typeof areasTable) => insertBuilder(t),
    },
    milestonesTable,
    tasksTable,
    areasTable,
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("drizzle-orm");
  return {
    ...actual,
    eq: (col: symbol, value: unknown) => ({ col, value }),
    and: (...preds: ({ col: symbol; value: unknown } | undefined)[]) => ({
      preds: preds.filter((p): p is { col: symbol; value: unknown } => p !== undefined),
    }),
    asc: (col: unknown) => col,
    desc: (col: unknown) => col,
    inArray: (col: symbol, values: unknown) => ({ col, value: values }),
  };
});

const { default: router } = await import("../milestones");

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as { userId?: string }).userId = "owner"; next(); });
  app.use("/api", router);
  return app;
}

async function postJson(
  app: Express,
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to bind test server");
  }
  const url = `http://127.0.0.1:${address.port}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  } finally {
    server.close();
  }
}

describe("POST /api/milestones/:id/breakdown", () => {
  beforeEach(() => {
    fixtures.milestones = [
      { id: 1, areaId: 100, title: "Launch the Aster site rebuild", description: "Three pages: home, about, contact." },
    ];
    fixtures.areas = [
      {
        id: 100,
        name: "Aster",
        description: "Client work",
        priority: "P1",
        isActiveThisWeek: true,
      },
    ];
    fixtures.tasks = [];
    fixtures.nextTaskId = 1000;
    // Force the AI path: stub the chat client to return a known JSON.
    setBreakdownChatClient(async () =>
      JSON.stringify({
        steps: [
          "Outline the three pages on the Aster site rebuild.",
          "Confirm homepage hero copy with Sara on Friday.",
          "Wire up the contact form to the inbox.",
        ],
      }),
    );
    process.env["OPENAI_API_KEY"] = "test-key";
  });

  it("creates tasks attached to the source goal (milestoneId set, not unassigned)", async () => {
    const app = buildApp();
    const { status, body } = await postJson(app, "/api/milestones/1/breakdown", {});

    expect(status).toBe(201);
    const created = body as Array<{ title: string; milestoneId: number; areaId: number; sortOrder: number }>;
    expect(created.length).toBeGreaterThanOrEqual(3);
    // Every created task must reference the source goal — not an orphan.
    expect(created.every((c) => c.milestoneId === 1)).toBe(true);
    expect(created.every((c) => c.areaId === 100)).toBe(true);
    // Steps come back ordered.
    expect(created.map((c) => c.sortOrder)).toEqual(created.map((_, i) => i + 1));

    // And nothing snuck into the task fixtures with a null milestoneId.
    const orphanCount = fixtures.tasks.filter((t) => t.milestoneId === null).length;
    expect(orphanCount).toBe(0);
  });

  it("returns 404 when the goal does not exist", async () => {
    const app = buildApp();
    const { status } = await postJson(app, "/api/milestones/9999/breakdown", {});
    expect(status).toBe(404);
  });

  it("returns 409 when the goal already has steps", async () => {
    fixtures.tasks.push({
      id: 500,
      title: "Existing step",
      category: "business",
      status: "pending",
      areaId: 100,
      milestoneId: 1,
      date: "2026-04-30",
      createdAt: new Date("2026-04-30T00:00:00Z"),
      parentTaskId: null,
      stepBackDepth: 0,
      blockerType: null,
      adjustmentType: null,
      adjustmentReason: null,
      taskSource: null,
      sortOrder: 1,
      whyItMatters: null,
      doneLooksLike: null,
      suggestedNextStep: null,
      blockerReason: null,
    });
    const app = buildApp();
    const { status } = await postJson(app, "/api/milestones/1/breakdown", {});
    expect(status).toBe(409);
  });

  it("falls back to deterministic steps when no API key is set, still attached to goal", async () => {
    delete process.env["OPENAI_API_KEY"];
    const app = buildApp();
    const { status, body } = await postJson(app, "/api/milestones/1/breakdown", {});
    expect(status).toBe(201);
    const created = body as Array<{ title: string; milestoneId: number }>;
    expect(created.every((c) => c.milestoneId === 1)).toBe(true);
    // Fallback should reference the goal title, not be pure boilerplate.
    expect(created.some((c) => c.title.includes("Aster"))).toBe(true);
  });
});
