import type { Tracking } from "@/data/contract";
import type { LoggedSet } from "@/data/workouts";

import {
  bucketStart,
  bucketStarts,
  e1rmSeries,
  findPrs,
  mostLoggedWeighted,
  muscleBalance,
  nextUpByFolder,
  prCountByWorkout,
  rangeStart,
  totals,
  volumePerBucket,
  weekStreak,
  workoutsPerBucket,
} from "../model";

let index = 0;
const set = (
  workout_id: string,
  performed_at: string,
  exercise_id: string,
  fields: Partial<LoggedSet> = {},
): LoggedSet => ({
  workout_id,
  performed_at,
  exercise_index: 0,
  set_index: index++,
  exercise_id,
  set_type: "normal",
  completed: true,
  ...fields,
});

const tracking: Record<string, Tracking> = {
  bench: "weight_reps",
  pullup: "reps_only",
  assisted: "assisted_bodyweight",
};
const trackingOf = (ref: string) => tracking[ref] ?? "weight_reps";

// Local-time dates, so the tests pass in any time zone.
const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).toISOString();

describe("buckets", () => {
  it("starts weeks on Monday and months on the 1st", () => {
    const wed = new Date(2026, 10, 18, 9); // Wed 18 Nov 2026
    expect(bucketStart(wed, "week")).toEqual(new Date(2026, 10, 16));
    expect(bucketStart(new Date(2026, 10, 22), "week")).toEqual(new Date(2026, 10, 16)); // Sun
    expect(bucketStart(wed, "month")).toEqual(new Date(2026, 10, 1));
  });

  it("covers a range up to the current bucket", () => {
    const now = new Date(2026, 10, 18);
    const starts = bucketStarts(rangeStart("1M", now), now, "week");
    expect(starts[0]).toEqual(new Date(2026, 9, 12));
    expect(starts.at(-1)).toEqual(new Date(2026, 10, 16));
    expect(starts).toHaveLength(6);
    expect(rangeStart("All", now, at(2026, 3, 5))).toEqual(new Date(2026, 2, 1));
  });

  it("counts workouts and volume per bucket", () => {
    const now = new Date(2026, 10, 18);
    const starts = bucketStarts(new Date(2026, 10, 9), now, "week");
    const workouts = [
      { id: "a", name: "A", started_at: at(2026, 11, 10), ended_at: at(2026, 11, 10, 19) },
      { id: "b", name: "B", started_at: at(2026, 11, 17), ended_at: at(2026, 11, 17, 19) },
      { id: "c", name: "C", started_at: at(2026, 11, 18), ended_at: at(2026, 11, 18, 19) },
    ];
    expect(workoutsPerBucket(workouts, starts, "week")).toEqual([1, 2]);
    const sets = [
      set("a", at(2026, 11, 10), "bench", { weight_kg: 100, reps: 5 }),
      set("a", at(2026, 11, 10), "bench", { weight_kg: 50, reps: 10, set_type: "warmup" }),
      set("b", at(2026, 11, 17), "bench", { weight_kg: 100, reps: 5, completed: false }),
      set("b", at(2026, 11, 17), "assisted", { weight_kg: 20, reps: 8 }),
      set("c", at(2026, 11, 18), "bench", { weight_kg: 80, reps: 10 }),
    ];
    expect(volumePerBucket(sets, starts, "week", trackingOf)).toEqual([500, 800]);
    expect(totals(workouts, sets, trackingOf)).toEqual({
      workouts: 3,
      volumeKg: 1300,
      seconds: 3 * 3600,
    });
  });
});

describe("weekStreak", () => {
  const w = (iso: string) => ({ started_at: iso });
  const now = new Date(2026, 10, 18); // Wednesday

  it("counts back from this week, or last week if this week is empty so far", () => {
    expect(weekStreak([w(at(2026, 11, 2)), w(at(2026, 11, 10)), w(at(2026, 11, 17))], now)).toBe(3);
    expect(weekStreak([w(at(2026, 11, 2)), w(at(2026, 11, 10))], now)).toBe(2);
  });

  it("is broken by a full week off", () => {
    expect(weekStreak([w(at(2026, 10, 26)), w(at(2026, 11, 10))], now)).toBe(1);
    expect(weekStreak([w(at(2026, 11, 2))], now)).toBe(0);
    expect(weekStreak([], now)).toBe(0);
  });
});

describe("muscleBalance", () => {
  it("counts working sets per group by primary muscle", () => {
    const muscles: Record<string, "chest" | "lats" | "cardio"> = {
      bench: "chest",
      pullup: "lats",
      run: "cardio",
    };
    const sets = [
      set("a", at(2026, 11, 10), "bench"),
      set("a", at(2026, 11, 10), "bench"),
      set("a", at(2026, 11, 10), "bench", { set_type: "warmup" }),
      set("a", at(2026, 11, 10), "pullup"),
      set("a", at(2026, 11, 10), "run"),
    ];
    const balance = muscleBalance(sets, (ref) => muscles[ref]);
    expect(balance.slice(0, 2)).toEqual([
      { group: "chest", sets: 2 },
      { group: "back", sets: 1 },
    ]);
    expect(balance).toHaveLength(6);
  });
});

describe("e1rm and PRs", () => {
  const sets = [
    set("w1", at(2026, 11, 2), "bench", { weight_kg: 80, reps: 5 }),
    set("w1", at(2026, 11, 2), "pullup", { reps: 8 }),
    set("w2", at(2026, 11, 4), "bench", { weight_kg: 80, reps: 8 }),
    set("w2", at(2026, 11, 4), "bench", { weight_kg: 85, reps: 1 }),
    set("w2", at(2026, 11, 4), "pullup", { reps: 8 }),
    set("w3", at(2026, 11, 6), "bench", { weight_kg: 70, reps: 5 }),
    set("w3", at(2026, 11, 6), "pullup", { reps: 10 }),
    set("w3", at(2026, 11, 6), "bench", { weight_kg: 90, reps: 1, completed: false }),
  ];

  it("takes the best e1RM per session", () => {
    expect(e1rmSeries(sets, "bench").map((p) => [p.workout_id, Math.round(p.kg)])).toEqual([
      ["w1", 93],
      ["w2", 101],
      ["w3", 82],
    ]);
  });

  it("finds PRs after the first session, ignoring unticked sets", () => {
    const prs = findPrs(sets, trackingOf);
    expect(prs.map((p) => [p.workout_id, p.exercise_id, p.kind, Math.round(p.value)])).toEqual([
      ["w2", "bench", "weight", 85],
      ["w2", "bench", "e1rm", 101],
      ["w3", "pullup", "reps", 10],
    ]);
    expect(prCountByWorkout(prs)).toEqual(
      new Map([
        ["w2", 2],
        ["w3", 1],
      ]),
    );
  });

  it("picks the most-logged weighted exercise", () => {
    expect(mostLoggedWeighted(sets, trackingOf)).toBe("bench");
    expect(mostLoggedWeighted([], trackingOf)).toBeUndefined();
  });
});

describe("nextUpByFolder", () => {
  const folder = { routines: [{ id: "push" }, { id: "pull" }, { id: "legs" }] };

  it("is the first never-done workout, else the one done longest ago", () => {
    expect(nextUpByFolder([folder], new Map([["push", "2026-11-10"]]))).toEqual(new Set(["pull"]));
    expect(
      nextUpByFolder(
        [folder],
        new Map([
          ["push", "2026-11-10"],
          ["pull", "2026-11-08"],
          ["legs", "2026-11-12"],
        ]),
      ),
    ).toEqual(new Set(["pull"]));
  });

  it("needs two workouts and some history", () => {
    expect(nextUpByFolder([folder], new Map())).toEqual(new Set());
    expect(nextUpByFolder([{ routines: [{ id: "a" }] }], new Map([["a", "x"]]))).toEqual(new Set());
  });
});
