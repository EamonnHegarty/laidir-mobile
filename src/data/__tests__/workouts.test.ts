import type { WorkoutExercise } from "../contract";
import { ValidationError } from "../store";
import { storedProblems } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

const squat = (weights: number[], completed = true): WorkoutExercise => ({
  exercise_id: "builtin:barbell-back-squat",
  sets: weights.map((weight_kg) => ({ set_type: "normal", weight_kg, reps: 5, completed })),
});

describe("workouts repository", () => {
  it("logs a workout from start to finish as a valid v1 Workout", async () => {
    const { db, clock, repos } = await setup();
    const started = await repos.workouts.start({ name: "Legs" });
    expect(started).not.toHaveProperty("ended_at");
    expect(await repos.workouts.getActive()).toEqual(started);

    clock.advance(30 * 60_000);
    await repos.workouts.save(started.id, { name: "Legs", exercises: [squat([100, 102.5])] });
    clock.advance(30 * 60_000);
    const finished = await repos.workouts.finish(started.id);

    expect(finished.ended_at).toBe("2026-11-15T10:00:00.000Z");
    expect(await repos.workouts.getActive()).toBeNull();
    expect(await repos.workouts.listHistory()).toEqual([finished]);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("knows when each workout template was last done, ignoring unfinished and deleted sessions", async () => {
    const { clock, repos } = await setup();
    const first = await repos.workouts.start({ name: "Push", routine_id: "r-push" });
    await repos.workouts.finish(first.id);
    clock.advance(24 * 60 * 60_000);
    const second = await repos.workouts.start({ name: "Push", routine_id: "r-push" });
    await repos.workouts.finish(second.id);
    clock.advance(60_000);
    const deleted = await repos.workouts.start({ name: "Pull", routine_id: "r-pull" });
    await repos.workouts.finish(deleted.id);
    await repos.workouts.remove(deleted.id);
    await repos.workouts.start({ name: "Legs", routine_id: "r-legs" });

    expect(await repos.workouts.lastDoneByRoutine()).toEqual(
      new Map([["r-push", second.started_at]]),
    );
  });

  it("allows only one workout in progress", async () => {
    const { repos } = await setup();
    await repos.workouts.start({ name: "A" });
    await expect(repos.workouts.start({ name: "B" })).rejects.toThrow(ValidationError);
  });

  it("keeps full-precision kg so lb entries round-trip", async () => {
    const { repos } = await setup();
    const kg = 185 * 0.45359237; // 185 lb
    const w = await repos.workouts.start({ name: "Bench", exercises: [squat([kg])] });
    expect((await repos.workouts.get(w.id))!.exercises[0]!.sets[0]!.weight_kg).toBe(kg);
  });

  it("set_log holds only finished, live workouts and follows edits and deletes", async () => {
    const { db, clock, repos } = await setup();
    const w = await repos.workouts.start({ name: "Legs", exercises: [squat([100, 105])] });
    expect(await db.all("SELECT * FROM set_log")).toEqual([]);

    await repos.workouts.finish(w.id, "2026-11-15T10:00:00.000Z");
    expect(await db.all("SELECT weight_kg FROM set_log ORDER BY set_index")).toEqual([
      { weight_kg: 100 },
      { weight_kg: 105 },
    ]);

    clock.advance(1);
    await repos.workouts.save(w.id, { name: "Legs", exercises: [squat([110])] });
    expect(await db.all("SELECT weight_kg FROM set_log")).toEqual([{ weight_kg: 110 }]);

    await repos.workouts.remove(w.id);
    expect(await db.all("SELECT * FROM set_log")).toEqual([]);
    expect(await repos.workouts.listHistory()).toEqual([]);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("lastPerformance returns the sets from the most recent finished workout", async () => {
    const { clock, repos } = await setup();
    const first = await repos.workouts.start({ name: "Legs", exercises: [squat([100, 100])] });
    await repos.workouts.finish(first.id);
    clock.advance(86_400_000);
    const second = await repos.workouts.start({
      name: "Legs",
      exercises: [squat([105, 107.5, 110])],
    });
    await repos.workouts.finish(second.id);
    clock.advance(86_400_000);
    await repos.workouts.start({ name: "Legs", exercises: [squat([200])] }); // in progress: ignored

    const last = await repos.workouts.lastPerformance("builtin:barbell-back-squat");
    expect(last.map((s) => s.weight_kg)).toEqual([105, 107.5, 110]);
    expect(last[0]).toMatchObject({ workout_id: second.id, reps: 5, completed: true });
    expect(last[0]).not.toHaveProperty("rpe");
    expect(await repos.workouts.lastPerformance("builtin:deadlift")).toEqual([]);
  });

  it("pages history newest first", async () => {
    const { clock, repos } = await setup();
    for (let i = 0; i < 3; i++) {
      const w = await repos.workouts.start({ name: `W${i}` });
      await repos.workouts.finish(w.id);
      clock.advance(86_400_000);
    }
    const page1 = await repos.workouts.listHistory({ limit: 2 });
    expect(page1.map((w) => w.name)).toEqual(["W2", "W1"]);
    const page2 = await repos.workouts.listHistory({ limit: 2, before: page1[1]!.started_at });
    expect(page2.map((w) => w.name)).toEqual(["W0"]);
  });

  it("rejects ending before the start", async () => {
    const { repos } = await setup();
    const w = await repos.workouts.start({ name: "A" });
    await expect(repos.workouts.finish(w.id, "2026-11-14T09:00:00.000Z")).rejects.toThrow(
      ValidationError,
    );
  });

  it("a failed write leaves the stored workout unchanged", async () => {
    const { db, repos } = await setup();
    const w = await repos.workouts.start({ name: "A", exercises: [squat([100])] });
    await expect(repos.workouts.save(w.id, { name: " ", exercises: [] })).rejects.toThrow();
    expect(await repos.workouts.get(w.id)).toEqual(w);
    expect(await storedProblems(db)).toEqual([]);
  });
});
