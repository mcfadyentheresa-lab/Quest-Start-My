import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { scoped, userIdFrom } from "../scoped";

const dialect = new PgDialect();

describe("scoped(userId)", () => {
  it("throws when userId is empty", () => {
    expect(() => scoped("")).toThrow(/userId is required/);
  });

  it("returns a helper bag for every multi-tenant table", () => {
    const s = scoped("user_a");
    for (const key of [
      "pillars",
      "tasks",
      "milestones",
      "weeklyPlans",
      "monthlyReviews",
      "progressLogs",
    ] as const) {
      expect(s[key].owns, `missing owns for ${key}`).toBeDefined();
      expect(typeof s[key].withUser, `missing withUser for ${key}`).toBe("function");
    }
  });

  it("withUser stamps the active userId on insert payloads", () => {
    const a = scoped("user_a");
    expect(a.pillars.withUser({ name: "X" })).toEqual({ name: "X", userId: "user_a" });
    expect(a.tasks.withUser({ title: "t", date: "2026-01-01", category: "business" }))
      .toEqual({ title: "t", date: "2026-01-01", category: "business", userId: "user_a" });
  });

  it("withUser cannot be tricked into using a different userId", () => {
    const a = scoped("user_a");
    // Even when the caller provides a userId, the scoped helper overrides it
    // because spread order means our userId wins. A route handler can never
    // accidentally write a row owned by another user.
    const stamped = a.pillars.withUser({ name: "X", userId: "user_b" } as Record<string, unknown>);
    expect(stamped).toMatchObject({ name: "X", userId: "user_a" });
  });

  it("a query for user A binds user A's id and never references user B's id", () => {
    const a = scoped("user_a");
    const b = scoped("user_b");

    const sqlA = dialect.sqlToQuery(a.pillars.owns);
    const sqlB = dialect.sqlToQuery(b.pillars.owns);

    expect(sqlA.params).toContain("user_a");
    expect(sqlA.params).not.toContain("user_b");

    expect(sqlB.params).toContain("user_b");
    expect(sqlB.params).not.toContain("user_a");

    // The predicate must filter on the user_id column, not bypass it.
    expect(sqlA.sql).toMatch(/"user_id"/);
    expect(sqlB.sql).toMatch(/"user_id"/);
  });

  it("predicates are produced for every tenant table and bind the correct user", () => {
    const s = scoped("user_a");
    for (const key of [
      "pillars",
      "tasks",
      "milestones",
      "weeklyPlans",
      "monthlyReviews",
      "progressLogs",
    ] as const) {
      const sql = dialect.sqlToQuery(s[key].owns);
      expect(sql.params, `${key} predicate must bind the userId`).toContain("user_a");
      expect(sql.sql, `${key} predicate must reference user_id column`).toMatch(/"user_id"/);
    }
  });
});

describe("userIdFrom(req)", () => {
  it("returns req.userId when set", () => {
    expect(userIdFrom({ userId: "user_a" })).toBe("user_a");
  });

  it("throws when req.userId is missing — surfacing a misconfigured route", () => {
    expect(() => userIdFrom({})).toThrow(/requireAuth/);
  });
});
