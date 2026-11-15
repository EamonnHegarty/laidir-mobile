import catalogueJson from "../../../contract/catalogue/v1/exercises.json";
import {
  allBuiltins,
  builtinRef,
  CATALOGUE_VERSION,
  describeExercise,
  findBuiltin,
  pickerBuiltins,
} from "../catalogue";
import type { Exercise } from "../contract";
import { catalogueErrors } from "../test-support/contract-validator";

const REF_PATTERN = /^builtin:[a-z0-9]+(-[a-z0-9]+)*$/;

describe("built-in catalogue", () => {
  it("matches its schema in the pinned contract", () => {
    expect(catalogueErrors(catalogueJson)).toEqual([]);
    expect(CATALOGUE_VERSION).toBeGreaterThanOrEqual(1);
    expect(allBuiltins.length).toBeGreaterThan(100);
  });

  it("produces valid exercise refs that resolve back", () => {
    for (const exercise of allBuiltins) {
      const ref = builtinRef(exercise.slug);
      expect(ref).toMatch(REF_PATTERN);
      expect(findBuiltin(ref)).toBe(exercise);
    }
  });

  it("offers only non-deprecated exercises in pickers, sorted by name", () => {
    expect(pickerBuiltins.every((e) => !e.deprecated)).toBe(true);
    const names = pickerBuiltins.map((e) => e.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("describeExercise", () => {
  const custom: Exercise = {
    id: "00000000-0000-4000-8000-000000000001",
    type: "EXERCISE",
    schema_version: 1,
    created_at: "2026-11-15T09:00:00.000Z",
    updated_at: "2026-11-15T09:00:00.000Z",
    deleted_at: null,
    name: "Landmine Press",
    equipment: "barbell",
    primary_muscle: "shoulders",
    tracking: "weight_reps",
  };

  it("describes a built-in", () => {
    const first = allBuiltins[0]!;
    expect(describeExercise(builtinRef(first.slug))).toMatchObject({
      name: first.name,
      source: "builtin",
      retired: false,
    });
  });

  it("keeps a deleted custom exercise's name, marked retired", () => {
    const deleted = { ...custom, deleted_at: "2026-11-16T09:00:00.000Z" };
    expect(describeExercise(custom.id, deleted)).toMatchObject({
      name: "Landmine Press",
      source: "custom",
      retired: true,
    });
  });

  it("falls back to a placeholder for unknown refs", () => {
    expect(describeExercise(custom.id, null)).toMatchObject({ source: "unknown" });
    expect(describeExercise("builtin:not-a-real-exercise")).toMatchObject({ source: "unknown" });
  });
});
