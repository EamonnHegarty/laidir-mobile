import type { Routine, WorkoutExercise } from "@/data/contract";
import type { LoggedSet } from "@/data/workouts";

import {
  addExercises,
  addSet,
  cleanForFinish,
  defaultSessionName,
  fieldsFor,
  moveExercise,
  removeSet,
  sessionFromRoutine,
  setHints,
  summarise,
  templateFor,
  toggleComplete,
  updateSet,
} from "../session";

const routine: Routine = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "ROUTINE",
  schema_version: 1,
  created_at: "2026-11-15T09:00:00.000Z",
  updated_at: "2026-11-15T09:00:00.000Z",
  deleted_at: null,
  name: "Push",
  exercises: [
    {
      exercise_id: "builtin:barbell-bench-press",
      rest_seconds: 180,
      sets: [
        { set_type: "warmup", target_reps_min: 10, target_reps_max: 10, target_weight_kg: 40 },
        { set_type: "normal", target_reps_min: 6, target_reps_max: 8, target_weight_kg: 80 },
      ],
    },
    { exercise_id: "builtin:pull-up", sets: [{ set_type: "normal" }] },
  ],
};

const logged = (weight_kg: number, reps: number, set_index: number): LoggedSet => ({
  workout_id: "w",
  performed_at: "2026-11-14T09:00:00.000Z",
  exercise_index: 0,
  set_index,
  exercise_id: "builtin:barbell-bench-press",
  set_type: "normal",
  completed: true,
  weight_kg,
  reps,
});

describe("session from a workout template", () => {
  it("copies exercises and set types with nothing done or filled in", () => {
    expect(sessionFromRoutine(routine)).toEqual([
      {
        exercise_id: "builtin:barbell-bench-press",
        sets: [
          { set_type: "warmup", completed: false },
          { set_type: "normal", completed: false },
        ],
      },
      { exercise_id: "builtin:pull-up", sets: [{ set_type: "normal", completed: false }] },
    ]);
  });

  it("finds the template exercise by position, falling back to the same exercise", () => {
    const session = sessionFromRoutine(routine);
    expect(templateFor(routine, session[0]!, 0)?.rest_seconds).toBe(180);
    const moved = moveExercise(session, 0, 1);
    expect(templateFor(routine, moved[1]!, 1)?.rest_seconds).toBe(180);
    expect(templateFor(null, session[0]!, 0)).toBeUndefined();
  });
});

describe("hints and ticking", () => {
  const session = sessionFromRoutine(routine);

  it("hints last time's values, then the template's targets", () => {
    const hints = setHints(session[0]!.sets, [logged(42.5, 10, 0)], routine.exercises[0]);
    expect(hints).toEqual([
      { weight_kg: 42.5, reps: 10 },
      { weight_kg: 80, reps: 8 },
    ]);
    expect(setHints(session[1]!.sets, [], undefined)).toEqual([{}]);
  });

  it("ticking fills empty fields from the hint and keeps typed values", () => {
    const typed = updateSet(session, 0, 1, { reps: 7 });
    const done = toggleComplete(typed, 0, 1, { weight_kg: 80, reps: 8 }, "weight_reps");
    expect(done[0]!.sets[1]).toEqual({
      set_type: "normal",
      completed: true,
      weight_kg: 80,
      reps: 7,
    });
    const undone = toggleComplete(done, 0, 1, { weight_kg: 80, reps: 8 }, "weight_reps");
    expect(undone[0]!.sets[1]).toEqual({
      set_type: "normal",
      completed: false,
      weight_kg: 80,
      reps: 7,
    });
  });

  it("only fills the fields the exercise tracks", () => {
    const done = toggleComplete(session, 1, 0, { weight_kg: 10, reps: 12 }, "reps_only");
    expect(done[1]!.sets[0]).toEqual({ set_type: "normal", completed: true, reps: 12 });
    expect(fieldsFor("distance_duration")).toEqual(["distance_m", "duration_s"]);
  });

  it("clearing a field removes it rather than storing undefined", () => {
    const set = updateSet(updateSet(session, 0, 0, { weight_kg: 40 }), 0, 0, {
      weight_kg: undefined,
    })[0]!.sets[0]!;
    expect(set).toEqual({ set_type: "warmup", completed: false });
  });
});

describe("editing the session", () => {
  it("adds exercises with three empty sets and sets matching the last type", () => {
    const added = addExercises([], ["builtin:deadlift"]);
    expect(added[0]!.sets).toHaveLength(3);
    const warm: WorkoutExercise[] = [
      { exercise_id: "x", sets: [{ set_type: "warmup", completed: true, weight_kg: 60 }] },
    ];
    expect(addSet(warm, 0)[0]!.sets[1]).toEqual({ set_type: "warmup", completed: false });
    expect(removeSet(warm, 0, 0)[0]!.sets).toEqual([]);
  });
});

describe("finishing", () => {
  const exercises: WorkoutExercise[] = [
    {
      exercise_id: "builtin:barbell-bench-press",
      sets: [
        { set_type: "warmup", completed: true, weight_kg: 40, reps: 10 },
        { set_type: "normal", completed: true, weight_kg: 80, reps: 8 },
        { set_type: "normal", completed: false, weight_kg: 80, reps: 6 },
        { set_type: "normal", completed: false },
      ],
    },
    { exercise_id: "builtin:pull-up", sets: [{ set_type: "normal", completed: false }] },
  ];

  it("drops empty unticked sets and then empty exercises", () => {
    const clean = cleanForFinish(exercises);
    expect(clean).toHaveLength(1);
    expect(clean[0]!.sets).toHaveLength(3);
    expect(clean[0]!.sets[2]).toMatchObject({ completed: false, reps: 6 });
  });

  it("summarises done sets and working volume", () => {
    expect(summarise(exercises)).toEqual({
      exercises: 2,
      completedSets: 2,
      unfinishedSets: 3,
      volumeKg: 640,
    });
  });

  it("names empty sessions by time of day", () => {
    expect(defaultSessionName(new Date(2026, 10, 15, 7))).toBe("Morning workout");
    expect(defaultSessionName(new Date(2026, 10, 15, 18))).toBe("Evening workout");
  });
});
