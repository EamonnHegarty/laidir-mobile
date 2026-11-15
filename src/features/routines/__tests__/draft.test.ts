import {
  addExercises,
  addSet,
  draftToInput,
  emptyDraft,
  MAX_EXERCISES,
  moveExercise,
  removeExercise,
  removeSet,
  setSummary,
  updateExercise,
  updateSet,
} from "../draft";

const base = addExercises(emptyDraft(), ["builtin:barbell-bench-press", "builtin:pull-up"], 120);

describe("routine draft", () => {
  it("adds exercises with three empty working sets and the default rest", () => {
    expect(base.exercises).toHaveLength(2);
    expect(base.exercises[0]).toEqual({
      exercise_id: "builtin:barbell-bench-press",
      rest_seconds: 120,
      sets: [{ set_type: "normal" }, { set_type: "normal" }, { set_type: "normal" }],
    });
  });

  it("caps exercises at the contract limit", () => {
    const refs = Array.from({ length: MAX_EXERCISES + 5 }, () => "builtin:pull-up");
    expect(addExercises(emptyDraft(), refs).exercises).toHaveLength(MAX_EXERCISES);
  });

  it("moves, removes and edits exercises without mutating the original", () => {
    const moved = moveExercise(base, 0, 1);
    expect(moved.exercises.map((e) => e.exercise_id)).toEqual([
      "builtin:pull-up",
      "builtin:barbell-bench-press",
    ]);
    expect(moveExercise(base, 0, -1)).toBe(base);
    expect(removeExercise(base, 0).exercises).toHaveLength(1);
    expect(updateExercise(base, 0, { rest_seconds: undefined }).exercises[0]).not.toHaveProperty(
      "rest_seconds",
    );
    expect(base.exercises[0]!.rest_seconds).toBe(120);
  });

  it("adds sets by copying the last one, and keeps at least one", () => {
    const withTargets = updateSet(base, 0, 2, {
      set_type: "normal",
      target_reps_min: 6,
      target_reps_max: 8,
      target_weight_kg: 80,
    });
    const added = addSet(withTargets, 0);
    expect(added.exercises[0]!.sets).toHaveLength(4);
    expect(added.exercises[0]!.sets[3]).toEqual(withTargets.exercises[0]!.sets[2]);

    let one = base;
    for (let i = 0; i < 5; i++) one = removeSet(one, 1, 0);
    expect(one.exercises[1]!.sets).toHaveLength(1);
  });

  it("removes cleared targets instead of storing undefined", () => {
    const set = updateSet(updateSet(base, 0, 0, { target_weight_kg: 80 }), 0, 0, {
      target_weight_kg: undefined,
    }).exercises[0]!.sets[0]!;
    expect(set).toEqual({ set_type: "normal" });
  });

  it("requires a name to save", () => {
    expect(draftToInput(base).problem).toMatch(/name/);
    expect(draftToInput({ ...base, name: "Push" }).input?.exercises).toHaveLength(2);
  });

  it("summarises sets", () => {
    const exercise = updateSet(
      updateSet(updateSet(base, 0, 0, { target_reps_min: 8, target_reps_max: 12 }), 0, 1, {
        target_reps_min: 8,
        target_reps_max: 12,
      }),
      0,
      2,
      { target_reps_min: 8, target_reps_max: 12 },
    ).exercises[0]!;
    expect(setSummary(exercise)).toBe("3 sets · 8–12 reps");
    expect(setSummary(base.exercises[1]!)).toBe("3 sets");
  });
});
