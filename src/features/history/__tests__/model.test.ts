import type { Workout } from "@/data/contract";

import { groupByMonth, sessionStats, templateFromSession } from "../model";

const session = (started_at: string, overrides: Partial<Workout> = {}): Workout => ({
  id: `00000000-0000-4000-8000-${started_at.slice(5, 7)}${started_at.slice(8, 10)}00000000`,
  type: "WORKOUT",
  schema_version: 1,
  created_at: started_at,
  updated_at: started_at,
  deleted_at: null,
  name: "Push",
  started_at,
  ended_at: new Date(Date.parse(started_at) + 3_600_000).toISOString(),
  exercises: [
    {
      exercise_id: "builtin:barbell-bench-press",
      sets: [
        { set_type: "warmup", completed: true, weight_kg: 40, reps: 10 },
        { set_type: "normal", completed: true, weight_kg: 80, reps: 8 },
        { set_type: "normal", completed: false, weight_kg: 80, reps: 5 },
      ],
    },
    { exercise_id: "builtin:pull-up", sets: [{ set_type: "normal", completed: false }] },
  ],
  ...overrides,
});

describe("history model", () => {
  it("groups newest-first sessions by month", () => {
    const sections = groupByMonth(
      [
        session("2026-11-14T09:00:00.000Z"),
        session("2026-11-02T09:00:00.000Z"),
        session("2026-10-30T09:00:00.000Z"),
      ],
      "en-IE",
    );
    expect(sections.map((s) => [s.title, s.data.length])).toEqual([
      ["November 2026", 2],
      ["October 2026", 1],
    ]);
  });

  it("works out duration, done sets and working volume", () => {
    expect(sessionStats(session("2026-11-14T09:00:00.000Z"))).toEqual({
      durationSeconds: 3600,
      completedSets: 2,
      volumeKg: 640,
    });
  });

  it("turns a session into a template with what was lifted as targets", () => {
    expect(templateFromSession(session("2026-11-14T09:00:00.000Z"))).toEqual({
      name: "Push",
      exercises: [
        {
          exercise_id: "builtin:barbell-bench-press",
          sets: [
            { set_type: "warmup", target_reps_min: 10, target_reps_max: 10, target_weight_kg: 40 },
            { set_type: "normal", target_reps_min: 8, target_reps_max: 8, target_weight_kg: 80 },
          ],
        },
      ],
    });
  });
});
