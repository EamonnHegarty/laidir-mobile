import type { ExerciseSession, LoggedSet } from "@/data/workouts";

import { exerciseRecords } from "../records";

const set = (weight_kg: number | undefined, reps: number, extra: Partial<LoggedSet> = {}) =>
  ({
    workout_id: "w",
    performed_at: "2026-11-15T09:00:00.000Z",
    exercise_index: 0,
    set_index: 0,
    exercise_id: "builtin:barbell-back-squat",
    set_type: "normal",
    completed: true,
    ...(weight_kg === undefined ? {} : { weight_kg }),
    reps,
    ...extra,
  }) as LoggedSet;

const session = (sets: LoggedSet[]): ExerciseSession => ({
  workout_id: "w",
  workout_name: "Legs",
  performed_at: "2026-11-15T09:00:00.000Z",
  sets,
});

describe("exerciseRecords", () => {
  it("finds heaviest and best estimated 1RM from completed working sets", () => {
    const records = exerciseRecords(
      [
        session([
          set(140, 1, { set_type: "warmup" }),
          set(150, 1, { completed: false }),
          set(120, 5),
          set(125, 2),
        ]),
      ],
      "weight_reps",
    );
    expect(records.heaviest?.weight_kg).toBe(125);
    // 120 × 5 ≈ 140 beats 125 × 2 ≈ 133.
    expect(records.bestOneRepMax?.set.weight_kg).toBe(120);
    expect(records.bestOneRepMax?.kg).toBeCloseTo(140);
    expect(records.sessions).toBe(1);
  });

  it("tracks most reps without weight records for reps-only exercises", () => {
    const records = exerciseRecords(
      [session([set(undefined, 12), set(undefined, 15)])],
      "reps_only",
    );
    expect(records.mostReps?.reps).toBe(15);
    expect(records.heaviest).toBeUndefined();
  });

  it("is empty without history", () => {
    expect(exerciseRecords([], "weight_reps")).toEqual({ sessions: 0 });
  });
});
