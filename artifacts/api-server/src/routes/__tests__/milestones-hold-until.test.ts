import { describe, expect, it, beforeEach, vi } from "vitest";
import express, { type Express } from "express";

// Test the hold-until-milestone-id validation rules: same-area, no-self, no-cycle.
// We mock @workspace/db with a small in-memory table that supports the select
// patterns the route uses.

type Milestone = {
  id: number;
  areaId: number;
  title: string;
  status: string;
  priority: string | null;
  targetDate: string | null;
  description: string | null;
  nextAction: string | null;
  sortOrder: number;
  mode: string;
  holdUntilMilestoneId: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const fixtures: { milestones: Milestone[] } = { milestones: [] };

const COL_M_ID = Symbol("milestones.id");
const COL_M_AREA = Symbol("milestones.areaId");
const COL_M_HOLD = Symbol("milestones.holdUntilMilestoneId");
const COL_M_COMPLETED = Symbol("milestones.completedAt");
const COL_M_SORT = Symbol("milestones.sortOrder");
const COL_M_CREATED = Symbol("milestones.createdAt");

vi.mock("@workspace/db", () => {
  const milestonesTable = {
    id: COL_M_ID,
    areaId: COL_M_AREA,
    holdUntilMilestoneId: COL_M_HOLD,
    completedAt: COL_M_COMPLETED,
    sortOrder: COL_M_SORT,
    createdAt: COL_M_CREATED,
  } as Record<string | symbol, unknown>;
  const tasksTable = {
    id: Symbol("tasks.id"),
  } as Record<string | symbol, unknown>;

  function makeSelect() {
    let columns: Record<string, symbol> | null = null;
    let whereCol: symbol | null = null;
    let whereVal: unknown = undefined;
    let whereOp: "eq" | "in" = "eq";
    const builder: Record<string, (...a: unknown[]) => unknown> = {
      from() { return builder; },
      where(p: { col: symbol; value: unknown; op?: "eq" | "in" }) {
        if (p && typeof p === "object" && "col" in p) {
          whereCol = p.col;
          whereVal = p.value;
          whereOp = p.op ?? "eq";
        }
        return builder;
      },
      orderBy() { return builder; },
      limit() { return builder; },
      then(resolve: (rows: unknown[]) => unknown) {
        let rows: Milestone[] = fixtures.milestones.slice();
        if (whereCol === COL_M_ID && whereOp === "eq") {
          rows = rows.filter((m) => m.id === whereVal);
        }
        if (whereCol === COL_M_ID && whereOp === "in") {
          const ids = (whereVal as number[]) ?? [];
          rows = rows.filter((m) => ids.includes(m.id));
        }
        if (whereCol === COL_M_AREA && whereOp === "eq") {
          rows = rows.filter((m) => m.areaId === whereVal);
        }
        // Project columns when select(...).
        const projected = columns
          ? rows.map((m) => {
              const out: Record<string, unknown> = {};
              for (const [k] of Object.entries(columns!)) {
                out[k] = (m as unknown as Record<string, unknown>)[k];
              }
              return out;
            })
          : rows;
        return Promise.resolve(projected).then(resolve);
      },
    };
    return (cols?: Record<string, symbol>) => {
      columns = cols ?? null;
      return builder;
    };
  }

  function makeInsert() {
    const builder: Record<string, (...a: unknown[]) => unknown> = {
      values(rowOrRows: unknown) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const created = rows.map((r) => {
          const data = r as Partial<Milestone>;
          const id = (fixtures.milestones.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1;
          const m: Milestone = {
            id,
            areaId: data.areaId ?? 0,
            title: data.title ?? "",
            status: data.status ?? "planned",
            priority: data.priority ?? null,
            targetDate: data.targetDate ?? null,
            description: data.description ?? null,
            nextAction: data.nextAction ?? null,
            sortOrder: data.sortOrder ?? 0,
            mode: data.mode ?? "ordered",
            holdUntilMilestoneId: data.holdUntilMilestoneId ?? null,
            completedAt: data.completedAt ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          fixtures.milestones.push(m);
          return m;
        });
        return {
          returning(): Promise<Milestone[]> { return Promise.resolve(created); },
        };
      },
    };
    return builder;
  }

  function makeUpdate() {
    let pending: Record<string, unknown> = {};
    let whereId: number | null = null;
    const builder: Record<string, (...a: unknown[]) => unknown> = {
      set(u: Record<string, unknown>) { pending = u; return builder; },
      where(p: { value: unknown }) { whereId = p.value as number; return builder; },
      returning(): Promise<Milestone[]> {
        const idx = fixtures.milestones.findIndex((m) => m.id === whereId);
        if (idx === -1) return Promise.resolve([]);
        const updated = { ...fixtures.milestones[idx]!, ...(pending as Partial<Milestone>) } as Milestone;
        fixtures.milestones[idx] = updated;
        return Promise.resolve([updated]);
      },
    };
    return builder;
  }

  const select = makeSelect();
  return {
    db: {
      select: (cols?: Record<string, symbol>) => select(cols),
      insert: () => makeInsert(),
      update: () => makeUpdate(),
    },
    milestonesTable,
    tasksTable,
    areasTable: { id: "id", name: "name" },
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("drizzle-orm");
  return {
    ...actual,
    eq: (col: symbol, value: unknown) => ({ col, value, op: "eq" }),
    and: (...preds: unknown[]) => preds[0],
    asc: (col: unknown) => col,
    desc: (col: unknown) => col,
    inArray: (col: symbol, values: unknown) => ({ col, value: values, op: "in" }),
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

async function reqJson(
  app: Express,
  method: "POST" | "PATCH" | "GET",
  path: string,
  body?: unknown,
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
      method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  } finally {
    server.close();
  }
}

function seed(rows: Partial<Milestone>[]) {
  fixtures.milestones = rows.map((r, i) => ({
    id: r.id ?? i + 1,
    areaId: r.areaId ?? 100,
    title: r.title ?? `M${i + 1}`,
    status: "planned",
    priority: null,
    targetDate: null,
    description: null,
    nextAction: null,
    sortOrder: r.sortOrder ?? i,
    mode: "ordered",
    holdUntilMilestoneId: r.holdUntilMilestoneId ?? null,
    completedAt: r.completedAt ?? null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    updatedAt: new Date("2026-04-01T00:00:00Z"),
  }));
}

describe("PATCH /api/milestones/:id — holdUntilMilestoneId validation", () => {
  beforeEach(() => {
    seed([
      { id: 1, areaId: 100, title: "Phase 1" },
      { id: 2, areaId: 100, title: "Phase 2" },
      { id: 3, areaId: 200, title: "Other-area goal" },
    ]);
  });

  it("accepts a same-area hold target and reflects isOnHold=true on read", async () => {
    const app = buildApp();
    const { status, body } = await reqJson(app, "PATCH", "/api/milestones/2", {
      holdUntilMilestoneId: 1,
    });
    expect(status).toBe(200);
    const m = body as { holdUntilMilestoneId: number | null; isOnHold: boolean };
    expect(m.holdUntilMilestoneId).toBe(1);
    expect(m.isOnHold).toBe(true);
  });

  it("flips isOnHold to false once the prerequisite is complete", async () => {
    fixtures.milestones[0]!.completedAt = new Date("2026-04-15T00:00:00Z");
    fixtures.milestones[1]!.holdUntilMilestoneId = 1;
    const app = buildApp();
    // List endpoint resolves prereq completion.
    const { status, body } = await reqJson(app, "GET", "/api/milestones?areaId=100");
    expect(status).toBe(200);
    const list = body as Array<{ id: number; isOnHold: boolean }>;
    const m2 = list.find((m) => m.id === 2)!;
    expect(m2.isOnHold).toBe(false);
  });

  it("rejects self-reference with 400", async () => {
    const app = buildApp();
    const { status, body } = await reqJson(app, "PATCH", "/api/milestones/1", {
      holdUntilMilestoneId: 1,
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/itself/);
  });

  it("rejects a hold target in another area with 400", async () => {
    const app = buildApp();
    const { status, body } = await reqJson(app, "PATCH", "/api/milestones/2", {
      holdUntilMilestoneId: 3,
    });
    expect(status).toBe(400);
    expect((body as { error: string }).error).toMatch(/same area/);
  });

  it("rejects a cycle with 409", async () => {
    // m1 already holds on m2. Now try to make m2 hold on m1 → cycle.
    fixtures.milestones[0]!.holdUntilMilestoneId = 2;
    const app = buildApp();
    const { status, body } = await reqJson(app, "PATCH", "/api/milestones/2", {
      holdUntilMilestoneId: 1,
    });
    expect(status).toBe(409);
    expect((body as { error: string }).error).toMatch(/cycle/);
  });
});
