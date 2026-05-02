import { describe, expect, it, beforeEach, vi } from "vitest";
import express, { type Express } from "express";

// In-memory fixtures the mock reads/writes against.
type Milestone = { id: number; areaId: number; title: string };
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

const fixtures: { milestones: Milestone[]; tasks: Task[]; nextTaskId: number } = {
  milestones: [],
  tasks: [],
  nextTaskId: 1,
};

// Shared marker the mocked drizzle helpers use to identify the table involved
// in a query. Drizzle's real chains accept column references; we only need to
// know "milestonesTable" vs "tasksTable" and which column was filtered on.
const MILESTONES = Symbol("milestonesTable");
const TASKS = Symbol("tasksTable");
const COL_MILESTONE_ID = Symbol("tasks.milestoneId");
const COL_MILESTONES_ID = Symbol("milestones.id");

vi.mock("@workspace/db", () => {
  const milestonesTable = {
    [Symbol.for("table")]: MILESTONES,
    id: COL_MILESTONES_ID,
    areaId: "areaId",
  } as Record<string | symbol, unknown>;
  const tasksTable = {
    [Symbol.for("table")]: TASKS,
    id: "id",
    milestoneId: COL_MILESTONE_ID,
    sortOrder: "sortOrder",
  } as Record<string | symbol, unknown>;

  // Each query builder is constructed fresh per `db.select(...)` /
  // `db.insert(...)` call.
  function selectBuilder(_columns?: unknown) {
    let table: symbol | null = null;
    let whereCol: symbol | null = null;
    let whereValue: unknown = null;

    const builder = {
      from(t: typeof milestonesTable | typeof tasksTable) {
        table = t[Symbol.for("table")] as symbol;
        return builder;
      },
      where(predicate: { col: symbol; value: unknown } | undefined) {
        if (predicate) {
          whereCol = predicate.col;
          whereValue = predicate.value;
        }
        return builder;
      },
      orderBy() {
        return builder;
      },
      then(resolve: (rows: unknown[]) => unknown) {
        const rows = run();
        return Promise.resolve(rows).then(resolve);
      },
    };

    function run(): unknown[] {
      if (table === MILESTONES) {
        let rows: Milestone[] = fixtures.milestones;
        if (whereCol === COL_MILESTONES_ID) {
          rows = rows.filter((m) => m.id === whereValue);
        }
        return rows;
      }
      if (table === TASKS) {
        let rows: Task[] = fixtures.tasks;
        if (whereCol === COL_MILESTONE_ID) {
          rows = rows.filter((t) => t.milestoneId === whereValue);
        }
        return rows.map((r) => ({ sortOrder: r.sortOrder, id: r.id }));
      }
      return [];
    }

    return builder;
  }

  function insertBuilder(t: typeof milestonesTable | typeof tasksTable) {
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
      insert: (t: typeof milestonesTable | typeof tasksTable) => insertBuilder(t),
    },
    milestonesTable,
    tasksTable,
    areasTable: { id: "id", name: "name" },
  };
});

// drizzle-orm helpers — just capture the column + value for the mock.
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("drizzle-orm");
  return {
    ...actual,
    eq: (col: symbol, value: unknown) => ({ col, value }),
    and: (...preds: unknown[]) => preds[0],
    asc: (col: unknown) => col,
    inArray: (col: symbol, values: unknown) => ({ col, value: values }),
  };
});

// Import the router AFTER the mocks are set up.
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

describe("POST /api/milestones/:id/steps/bulk", () => {
  beforeEach(() => {
    fixtures.milestones = [{ id: 1, areaId: 100, title: "Launch site" }];
    fixtures.tasks = [
      // Existing step at sortOrder 5 — new ones should append after.
      {
        id: 999,
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
        sortOrder: 5,
        whyItMatters: null,
        doneLooksLike: null,
        suggestedNextStep: null,
        blockerReason: null,
      },
    ];
    fixtures.nextTaskId = 1000;
  });

  it("appends three steps in order after existing sortOrder", async () => {
    const app = buildApp();
    const { status, body } = await postJson(app, "/api/milestones/1/steps/bulk", {
      titles: ["First", "Second", "Third"],
    });

    expect(status).toBe(201);
    const created = body as Array<{ title: string; sortOrder: number; milestoneId: number }>;
    expect(created).toHaveLength(3);
    expect(created.map((c) => c.title)).toEqual(["First", "Second", "Third"]);
    expect(created.map((c) => c.sortOrder)).toEqual([6, 7, 8]);
    expect(created.every((c) => c.milestoneId === 1)).toBe(true);
  });

  it("rejects an empty titles array with 400", async () => {
    const app = buildApp();
    const { status } = await postJson(app, "/api/milestones/1/steps/bulk", {
      titles: [],
    });
    expect(status).toBe(400);
  });

  it("rejects titles that are only whitespace as empty (400)", async () => {
    const app = buildApp();
    const { status } = await postJson(app, "/api/milestones/1/steps/bulk", {
      titles: ["   ", ""],
    });
    expect(status).toBe(400);
  });

  it("rejects titles longer than the limit and lists offending indices", async () => {
    const app = buildApp();
    const longTitle = "x".repeat(281);
    const { status, body } = await postJson(app, "/api/milestones/1/steps/bulk", {
      titles: ["ok", longTitle, "also ok"],
    });
    expect(status).toBe(400);
    const err = body as { offendingIndices?: number[] };
    expect(err.offendingIndices).toEqual([1]);
  });

  it("returns 404 when the milestone does not exist", async () => {
    const app = buildApp();
    const { status } = await postJson(app, "/api/milestones/9999/steps/bulk", {
      titles: ["First"],
    });
    expect(status).toBe(404);
  });

  it("trims and drops empty lines before saving", async () => {
    const app = buildApp();
    const { status, body } = await postJson(app, "/api/milestones/1/steps/bulk", {
      titles: ["  First  ", "", "Second"],
    });
    expect(status).toBe(201);
    const created = body as Array<{ title: string }>;
    expect(created.map((c) => c.title)).toEqual(["First", "Second"]);
  });
});
