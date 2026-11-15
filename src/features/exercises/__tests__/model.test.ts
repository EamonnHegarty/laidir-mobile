import type { Exercise } from "@/data/contract";

import { exerciseListItems, filterExercises, normalise } from "../model";

const custom = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "00000000-0000-4000-8000-000000000001",
  type: "EXERCISE",
  schema_version: 1,
  created_at: "2026-11-15T09:00:00.000Z",
  updated_at: "2026-11-15T09:00:00.000Z",
  deleted_at: null,
  name: "Landmine Press",
  equipment: "barbell",
  primary_muscle: "shoulders",
  secondary_muscles: ["triceps"],
  tracking: "weight_reps",
  ...overrides,
});

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

describe("exercise list", () => {
  const items = exerciseListItems([
    custom(),
    custom({
      id: "00000000-0000-4000-8000-000000000002",
      name: "Gone",
      deleted_at: "2026-11-15T10:00:00.000Z",
    }),
  ]);

  it("merges built-ins with live custom exercises, sorted by name", () => {
    expect(items.some((i) => i.ref === "builtin:barbell-bench-press")).toBe(true);
    expect(items.filter((i) => i.custom).map((i) => i.name)).toEqual(["Landmine Press"]);
    const names = items.map((i) => i.name);
    expect(names).toEqual([...names].sort(byName));
  });

  it("matches every search word in any order, with gym shorthand", () => {
    const names = (search: string) => filterExercises(items, { search }).map((i) => i.name);
    expect(names("bench dumbbell")).toContain("Bench Press (Dumbbell)");
    expect(names("db bench")).toContain("Bench Press (Dumbbell)");
    expect(names("db bench")).not.toContain("Bench Press (Barbell)");
    expect(filterExercises(items, { search: "LANDMINE" }).filter((i) => i.custom)).toHaveLength(1);
    expect(names("zzz")).toEqual([]);
  });

  it("filters by primary or secondary muscle", () => {
    const triceps = filterExercises(items, { muscle: "triceps" });
    expect(triceps.map((i) => i.name)).toContain("Landmine Press");
    for (const item of triceps) {
      expect(item.primary_muscle === "triceps" || item.secondary_muscles.includes("triceps")).toBe(
        true,
      );
    }
  });

  it("normalises accents and punctuation", () => {
    expect(normalise("Láidir: Bench-Press (DB)")).toBe("laidir bench press db");
  });
});
