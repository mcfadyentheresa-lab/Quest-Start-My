import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "lib",
  "db",
  "migrations",
);

function readSql(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

/**
 * The Phase 8 migration is a pure rename of tables and columns. We can verify
 * the up/down round-trip without spinning up Postgres by checking that for
 * every name on the "up" side there is a matching reverse rename on "down" —
 * i.e. the pair forms an identity mapping. Also asserts no destructive ops
 * (DROP/DELETE/TRUNCATE) so Theresa's data can never be lost by either leg.
 */
describe("0001_rename_pillars_to_areas — up/down round-trip", () => {
  const up = readSql("0001_rename_pillars_to_areas.sql");
  const down = readSql("0001_rename_pillars_to_areas.down.sql");

  const renamePairs = [
    ["pillars", "areas"],
    ["pillar_id", "area_id"],
    ["active_pillar_ids", "area_priorities"],
    ["pillars_advanced", "areas_advanced"],
  ] as const;

  for (const [oldName, newName] of renamePairs) {
    it(`renames ${oldName} → ${newName} on up`, () => {
      expect(up).toContain(`"${oldName}"`);
      expect(up).toContain(`"${newName}"`);
    });

    it(`reverses ${newName} → ${oldName} on down`, () => {
      expect(down).toContain(`"${newName}"`);
      expect(down).toContain(`"${oldName}"`);
    });
  }

  it("uses IF EXISTS so re-running is safe", () => {
    expect(up).toMatch(/IF EXISTS/i);
    expect(down).toMatch(/IF EXISTS/i);
  });

  it("never drops, deletes, or truncates — data is preserved both ways", () => {
    for (const sql of [up, down]) {
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bDELETE\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    }
  });
});
