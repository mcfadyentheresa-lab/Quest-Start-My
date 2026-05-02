import { describe, expect, it, beforeEach, vi } from "vitest";
import express, { type Express } from "express";

type Area = {
  id: number;
  name: string;
  priority: string;
  description: string | null;
  isActiveThisWeek: boolean;
  color: string | null;
  createdAt: Date;
  portfolioStatus: string | null;
  nowFocus: string | null;
  lastUpdated: string | null;
  category: string | null;
  honestNote: string | null;
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
  taskSource: string | null;
};
type Milestone = {
  id: number;
  areaId: number;
  title: string;
  status: string;
  holdUntilMilestoneId: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sortOrder: number;
};
type ProgressLog = {
  id: number;
  taskId: number | null;
  taskTitle: string;
  category: string;
  status: string;
  date: string;
  loggedAt: Date;
};

const fixtures: {
  areas: Area[];
  tasks: Task[];
  milestones: Milestone[];
  progressLogs: ProgressLog[];
} = { areas: [], tasks: [], milestones: [], progressLogs: [] };

const AREAS = Symbol("areasTable");
const TASKS = Symbol("tasksTable");
const MILESTONES = Symbol("milestonesTable");
const LOGS = Symbol("progressLogsTable");

vi.mock("@workspace/db", () => {
  const areasTable = { [Symbol.for("table")]: AREAS } as Record<string | symbol, unknown>;
  const tasksTable = { [Symbol.for("table")]: TASKS, date: "tasks.date" } as Record<string | symbol, unknown>;
  const milestonesTable = { [Symbol.for("table")]: MILESTONES } as Record<string | symbol, unknown>;
  const progressLogsTable = { [Symbol.for("table")]: LOGS, date: "logs.date" } as Record<string | symbol, unknown>;

  function selectBuilder() {
    let target: symbol | null = null;
    let dateBounds: { gte?: string; lte?: string } | null = null;
    const builder = {
      from(table: { [k: symbol]: symbol }) {
        target = table[Symbol.for("table")] ?? null;
        return builder;
      },
      where(clause: unknown) {
        if (clause && typeof clause === "object" && "bounds" in (clause as Record<string, unknown>)) {
          dateBounds = (clause as { bounds: { gte?: string; lte?: string } }).bounds;
        }
        return builder;
      },
      orderBy() { return builder; },
      then(resolve: (rows: unknown[]) => unknown) {
        let rows: unknown[] = [];
        if (target === AREAS) rows = fixtures.areas;
        else if (target === MILESTONES) rows = fixtures.milestones;
        else if (target === TASKS) {
          rows = fixtures.tasks.filter((t) => {
            if (dateBounds?.gte && t.date < dateBounds.gte) return false;
            if (dateBounds?.lte && t.date > dateBounds.lte) return false;
            return true;
          });
        } else if (target === LOGS) {
          rows = fixtures.progressLogs.filter((l) => {
            if (dateBounds?.gte && l.date < dateBounds.gte) return false;
            if (dateBounds?.lte && l.date > dateBounds.lte) return false;
            return true;
          });
        }
        return Promise.resolve(rows).then(resolve);
      },
    };
    return builder;
  }

  return {
    db: {
      select: () => selectBuilder(),
      insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
    },
    areasTable,
    tasksTable,
    milestonesTable,
    progressLogsTable,
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("drizzle-orm");
  return {
    ...actual,
    eq: () => ({}),
    and: (...preds: unknown[]) => {
      const bounds: { gte?: string; lte?: string } = {};
      for (const p of preds) {
        if (p && typeof p === "object") {
          const cur = p as { _gte?: string; _lte?: string };
          if (cur._gte) bounds.gte = cur._gte;
          if (cur._lte) bounds.lte = cur._lte;
        }
      }
      return { bounds };
    },
    gte: (_col: unknown, value: string) => ({ _gte: value }),
    lte: (_col: unknown, value: string) => ({ _lte: value }),
  };
});

const { default: router, clearYearRibbonCache } = await import("../year-ribbon");

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

async function getJson(
  app: Express,
  path: string,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to bind test server");
  }
  const url = `http://127.0.0.1:${address.port}${path}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, body: parsed, headers };
  } finally {
    server.close();
  }
}

function makeArea(id: number, overrides: Partial<Area> = {}): Area {
  return {
    id,
    name: `Area ${id}`,
    priority: "P1",
    description: null,
    isActiveThisWeek: true,
    color: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    portfolioStatus: null,
    nowFocus: null,
    lastUpdated: null,
    category: null,
    honestNote: null,
    ...overrides,
  };
}

describe("GET /api/year-ribbon", () => {
  beforeEach(() => {
    fixtures.areas = [];
    fixtures.tasks = [];
    fixtures.milestones = [];
    fixtures.progressLogs = [];
    clearYearRibbonCache();
  });

  it("returns 52 weeks of empty buckets when there is no activity", async () => {
    fixtures.areas = [makeArea(1)];
    const app = buildApp();
    const { status, body } = await getJson(app, "/api/year-ribbon?year=2026");
    expect(status).toBe(200);
    const payload = body as { year: number; weeks: number; areas: { id: number; weeks: { completedTasks: number }[] }[] };
    expect(payload.year).toBe(2026);
    expect(payload.weeks).toBe(52);
    expect(payload.areas).toHaveLength(1);
    expect(payload.areas[0]!.weeks).toHaveLength(52);
    expect(payload.areas[0]!.weeks.every((w) => w.completedTasks === 0)).toBe(true);
  });

  it("buckets task creations into the week of the task's date", async () => {
    fixtures.areas = [makeArea(7)];
    fixtures.tasks = [
      {
        id: 1, title: "t", category: "business", status: "pending",
        areaId: 7, milestoneId: null, date: "2026-01-01",
        createdAt: new Date("2026-01-01"), taskSource: null,
      },
      {
        id: 2, title: "t2", category: "business", status: "pending",
        areaId: 7, milestoneId: null, date: "2026-01-15",
        createdAt: new Date("2026-01-15"), taskSource: null,
      },
    ];
    const app = buildApp();
    const { body } = await getJson(app, "/api/year-ribbon?year=2026");
    const payload = body as { areas: { weeks: { index: number; createdTasks: number }[] }[] };
    const weeks = payload.areas[0]!.weeks;
    expect(weeks[0]!.createdTasks).toBe(1);
    expect(weeks[2]!.createdTasks).toBe(1);
  });

  it("counts completed tasks from progress logs and emits a goal bar", async () => {
    fixtures.areas = [makeArea(3)];
    fixtures.milestones = [
      {
        id: 11, areaId: 3, title: "Site rebuild", status: "active",
        holdUntilMilestoneId: null, completedAt: null,
        createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
        sortOrder: 0,
      },
    ];
    fixtures.tasks = [
      {
        id: 100, title: "Step A", category: "business", status: "done",
        areaId: 3, milestoneId: 11, date: "2026-02-26",
        createdAt: new Date("2026-02-26"), taskSource: null,
      },
      {
        id: 101, title: "Step B", category: "business", status: "done",
        areaId: 3, milestoneId: 11, date: "2026-04-23",
        createdAt: new Date("2026-04-23"), taskSource: null,
      },
    ];
    fixtures.progressLogs = [
      { id: 1, taskId: 100, taskTitle: "Step A", category: "business", status: "done", date: "2026-02-26", loggedAt: new Date() },
      { id: 2, taskId: 101, taskTitle: "Step B", category: "business", status: "done", date: "2026-04-23", loggedAt: new Date() },
    ];
    const app = buildApp();
    const { body } = await getJson(app, "/api/year-ribbon?year=2026");
    const payload = body as {
      areas: {
        weeks: { index: number; completedTasks: number; closedSteps: number }[];
        goalBars: { goalId: number; startWeek: number; endWeek: number; status: string }[];
      }[];
    };
    const weeks = payload.areas[0]!.weeks;
    const sumDone = weeks.reduce((s, w) => s + w.completedTasks, 0);
    const sumSteps = weeks.reduce((s, w) => s + w.closedSteps, 0);
    expect(sumDone).toBe(2);
    expect(sumSteps).toBe(2);
    expect(payload.areas[0]!.goalBars).toHaveLength(1);
    const bar = payload.areas[0]!.goalBars[0]!;
    expect(bar.goalId).toBe(11);
    expect(bar.startWeek).toBeLessThan(bar.endWeek);
  });

  it("rejects an invalid year", async () => {
    const app = buildApp();
    const { status } = await getJson(app, "/api/year-ribbon?year=abcd");
    expect(status).toBe(400);
  });

  it("caches the response and serves repeat requests from cache", async () => {
    fixtures.areas = [makeArea(1)];
    const app = buildApp();
    const first = await getJson(app, "/api/year-ribbon?year=2026");
    expect(first.headers["x-year-ribbon-cache"]).toBe("miss");
    const second = await getJson(app, "/api/year-ribbon?year=2026");
    expect(second.headers["x-year-ribbon-cache"]).toBe("hit");
  });

  it("places active areas before inactive, sorted by priority", async () => {
    fixtures.areas = [
      makeArea(1, { name: "Low", priority: "P3", isActiveThisWeek: true }),
      makeArea(2, { name: "Inactive", priority: "P1", isActiveThisWeek: false }),
      makeArea(3, { name: "Top", priority: "P1", isActiveThisWeek: true }),
    ];
    const app = buildApp();
    const { body } = await getJson(app, "/api/year-ribbon?year=2026");
    const payload = body as { areas: { id: number; name: string }[] };
    expect(payload.areas.map((a) => a.id)).toEqual([3, 1, 2]);
  });
});
