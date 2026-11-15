import {
  cleanForFinish,
  sessionFromRoutine,
  setHints,
  templateFor,
  toggleComplete,
  updateSet,
} from "@/features/workout/session";

import { storedProblems } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

describe("logging a session from a workout template", () => {
  it("stores valid v1 documents from start to finish, and feeds next time's hints", async () => {
    const { db, clock, repos } = await setup();
    const push = await repos.routines.create({
      name: "Push",
      exercises: [
        {
          exercise_id: "builtin:barbell-bench-press",
          rest_seconds: 180,
          sets: [
            { set_type: "normal", target_reps_min: 6, target_reps_max: 8, target_weight_kg: 80 },
            { set_type: "normal", target_reps_min: 6, target_reps_max: 8, target_weight_kg: 80 },
          ],
        },
      ],
    });

    const session = await repos.workouts.start({
      name: push.name,
      routine_id: push.id,
      exercises: sessionFromRoutine(push),
    });
    let exercises = session.exercises;
    const hints = setHints(exercises[0]!.sets, [], templateFor(push, exercises[0]!, 0));
    exercises = toggleComplete(exercises, 0, 0, hints[0], "weight_reps"); // accept the target
    exercises = updateSet(exercises, 0, 1, { weight_kg: 82.5, reps: 6 });
    exercises = toggleComplete(exercises, 0, 1, hints[1], "weight_reps");
    exercises = [
      ...exercises,
      { exercise_id: "builtin:pull-up", sets: [{ set_type: "normal", completed: false }] },
    ];

    clock.advance(45 * 60_000);
    await repos.workouts.save(session.id, { name: "Push", exercises: cleanForFinish(exercises) });
    const finished = await repos.workouts.finish(session.id);

    expect(finished.exercises).toEqual([
      {
        exercise_id: "builtin:barbell-bench-press",
        sets: [
          { set_type: "normal", completed: true, weight_kg: 80, reps: 8 },
          { set_type: "normal", completed: true, weight_kg: 82.5, reps: 6 },
        ],
      },
    ]);
    expect(await storedProblems(db)).toEqual([]);

    // Next time, last session's sets become the hints.
    const last = await repos.workouts.lastPerformance("builtin:barbell-bench-press");
    expect(setHints(sessionFromRoutine(push)[0]!.sets, last, push.exercises[0])).toEqual([
      { weight_kg: 80, reps: 8 },
      { weight_kg: 82.5, reps: 6 },
    ]);
  });
});
