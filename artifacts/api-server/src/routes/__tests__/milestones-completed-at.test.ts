import { describe, expect, it, beforeEach, vi } from "vitest";
import express, { type Express } from "express";

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
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const fixtures: { milestones: Milestone[] } = { milestones: [] };

const MILESTONES = Symbol("milestonesTable");
const COL_MILESTONES_ID = Symbol("milestones.id");

vi.mock("@workspace/db", () => {
  const milestonesTable = {
    [Symbol.for("table")]: MILESTONES,
    id: COL_MILESTONES_ID,
  } as Record<string | symbol, unknown>;
  const tasksTable = {
    [Symbol.for("table")]: Symbol("tasksTable"),
  } as Record<string | symbol, unknown>;

  function selectBuilder() {
    const builder = {
      from() { return builder; },
      where() { return builder; },
      orderBy() { return builder; },
      then(resolve: (rows: unknown[]) => unknown) {
        return Promise.resolve([]).then(resolve);
      },
    };
    return builder;
  }

  function insertBuilder() {
    const builder = {
      values() { return builder; },
      returning(): Promise<unknown[]> { return Promise.resolve([]); },
    };
    return builder;
  }

  function updateBuilder() {
    let pendingUpdates: Record<string, unknown> = {};
    let whereId: number | null = null;
    const builder = {
      set(updates: Record<string, unknown>) {
        pendingUpdates = updates;
        return builder;
      },
      where(predicate: { col: symbol; value: unknown }) {
        whereId = predicate.value as number;
        return builder;
      },
      returning(): Promise<unknown[]> {
        const idx = fixtures.milestones.findIndex((m) => m.id === whereId);
        if (idx === -1) return Promise.resolve([]);
        const m = fixtures.milestones[idx]!;
        const updated: Milestone = {
          ...m,
          ...(pendingUpdates as Partial<Milestone>),
        };
        fixtures.milestones[idx] = updated;
        return Promise.resolve([updated]);
      },
    };
    return builder;
  }

  return {
    db: {
      select: () => selectBuilder(),
      insert: () => insertBuilder(),
      update: () => updateBuilder(),
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
    eq: (col: symbol, value: unknown) => ({ col, value }),
    and: (...preds: unknown[]) => preds[0],
    asc: (col: unknown) => col,
    inArray: (col: symbol, values: unknown) => ({ col, value: values }),
  };
});

const { default: router } = await import("../milestones");

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

async function patchJson(
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
      method: "PATCH",
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

describe("PATCH /api/milestones/:id — completedAt", () => {
  beforeEach(() => {
    fixtures.milestones = [
      {
        id: 1,
        areaId: 100,
        title: "Launch site",
        status: "active",
        priority: null,
        targetDate: null,
        description: null,
        nextAction: null,
        sortOrder: 0,
        mode: "ordered",
        completedAt: null,
        createdAt: new Date("2026-04-01T00:00:00Z"),
        updatedAt: new Date("2026-04-01T00:00:00Z"),
      },
    ];
  });

  it("sets completedAt from an ISO timestamp", async () => {
    const app = buildApp();
    const iso = "2026-05-01T12:00:00.000Z";
    const { status, body } = await patchJson(app, "/api/milestones/1", {
      completedAt: iso,
    });

    expect(status).toBe(200);
    const m = body as { completedAt: string | null };
    expect(m.completedAt).toBe(iso);
    expect(fixtures.milestones[0]!.completedAt).toEqual(new Date(iso));
  });

  it("clears completedAt when sent as null", async () => {
    fixtures.milestones[0]!.completedAt = new Date("2026-05-01T12:00:00.000Z");
    const app = buildApp();
    const { status, body } = await patchJson(app, "/api/milestones/1", {
      completedAt: null,
    });

    expect(status).toBe(200);
    const m = body as { completedAt: string | null };
    expect(m.completedAt).toBeNull();
    expect(fixtures.milestones[0]!.completedAt).toBeNull();
  });

  it("leaves completedAt unchanged when the field is absent from the patch", async () => {
    const original = new Date("2026-05-01T12:00:00.000Z");
    fixtures.milestones[0]!.completedAt = original;
    const app = buildApp();
    const { status, body } = await patchJson(app, "/api/milestones/1", {
      title: "Renamed",
    });

    expect(status).toBe(200);
    const m = body as { title: string; completedAt: string | null };
    expect(m.title).toBe("Renamed");
    expect(m.completedAt).toBe(original.toISOString());
  });
});
