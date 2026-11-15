import { templateFromSession } from "@/features/history/model";
import { cleanForFinish } from "@/features/workout/session";

import { storedProblems } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

describe("editing history", () => {
  it("edits a finished session, saves it as a template, and deletes it, all as valid v1 items", async () => {
    const { db, clock, repos } = await setup();
    const w = await repos.workouts.start({
      name: "Legs",
      exercises: [
        {
          exercise_id: "builtin:barbell-back-squat",
          sets: [{ set_type: "normal", completed: true, weight_kg: 100, reps: 5 }],
        },
      ],
    });
    clock.advance(3_600_000);
    const finished = await repos.workouts.finish(w.id);

    // Fix a typo'd weight and add a forgotten set, the way the Edit screen saves.
    clock.advance(86_400_000);
    const edited = await repos.workouts.save(w.id, {
      name: "Legs",
      exercises: cleanForFinish([
        {
          exercise_id: "builtin:barbell-back-squat",
          sets: [
            { set_type: "normal", completed: true, weight_kg: 102.5, reps: 5 },
            { set_type: "normal", completed: true, weight_kg: 102.5, reps: 5 },
            { set_type: "normal", completed: false },
          ],
        },
      ]),
    });
    expect(edited.ended_at).toBe(finished.ended_at);
    expect(edited.exercises[0]!.sets).toHaveLength(2);
    expect((await repos.workouts.lastPerformance("builtin:barbell-back-squat")).length).toBe(2);

    const template = await repos.routines.create(templateFromSession(edited));
    expect(template.exercises[0]!.sets[0]).toMatchObject({ target_weight_kg: 102.5 });

    await repos.workouts.remove(w.id);
    expect(await repos.workouts.listHistory()).toEqual([]);
    expect(await storedProblems(db)).toEqual([]);
  });
});
