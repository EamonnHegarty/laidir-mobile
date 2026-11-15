import { setup } from "../test-support/setup";

describe("exerciseHistory", () => {
  it("groups an exercise's sets by workout, newest first, limited by workout count", async () => {
    const { clock, repos } = await setup();
    const log = async (name: string, weights: number[]) => {
      const w = await repos.workouts.start({
        name,
        exercises: [
          {
            exercise_id: "builtin:barbell-back-squat",
            sets: weights.map((weight_kg) => ({
              set_type: "normal",
              weight_kg,
              reps: 5,
              completed: true,
            })),
          },
          {
            exercise_id: "builtin:deadlift",
            sets: [{ set_type: "normal", reps: 3, completed: true }],
          },
        ],
      });
      await repos.workouts.finish(w.id);
      clock.advance(86_400_000);
    };
    await log("Mon", [100]);
    await log("Wed", [105, 105]);
    await log("Fri", [110]);

    const history = await repos.workouts.exerciseHistory("builtin:barbell-back-squat", {
      limit: 2,
    });
    expect(history.map((s) => [s.workout_name, s.sets.map((x) => x.weight_kg)])).toEqual([
      ["Fri", [110]],
      ["Wed", [105, 105]],
    ]);
    expect(await repos.workouts.exerciseHistory("builtin:leg-press")).toEqual([]);
  });
});
