import { NotFoundError, ValidationError } from "../store";
import { storedProblems } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

const input = {
  name: "  Landmine Press ",
  equipment: "barbell",
  primary_muscle: "shoulders",
  tracking: "weight_reps",
} as const;

describe("exercises repository", () => {
  it("creates a valid v1 Exercise with absent optional fields", async () => {
    const { db, repos } = await setup();
    const exercise = await repos.exercises.create({ ...input, notes: "  ", secondary_muscles: [] });
    expect(exercise).toEqual({
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
    });
    expect(await storedProblems(db)).toEqual([]);
  });

  it("rejects empty and over-long names", async () => {
    const { repos } = await setup();
    await expect(repos.exercises.create({ ...input, name: "   " })).rejects.toThrow(
      ValidationError,
    );
    await expect(repos.exercises.create({ ...input, name: "x".repeat(101) })).rejects.toThrow(
      ValidationError,
    );
  });

  it("update replaces the editable fields and bumps updated_at", async () => {
    const { db, clock, repos } = await setup();
    const created = await repos.exercises.create({ ...input, notes: "keep elbows in" });
    clock.advance(60_000);
    const updated = await repos.exercises.update(created.id, {
      ...input,
      secondary_muscles: ["triceps"],
    });
    expect(updated.created_at).toBe(created.created_at);
    expect(updated.updated_at).toBe("2026-11-15T09:01:00.000Z");
    expect(updated.secondary_muscles).toEqual(["triceps"]);
    expect(updated).not.toHaveProperty("notes");
    expect(await repos.exercises.get(created.id)).toEqual(updated);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("keeps updated_at strictly increasing when the clock does not move", async () => {
    const { repos } = await setup();
    const created = await repos.exercises.create(input);
    const a = await repos.exercises.update(created.id, input);
    const b = await repos.exercises.update(created.id, input);
    expect(a.updated_at > created.updated_at).toBe(true);
    expect(b.updated_at > a.updated_at).toBe(true);
  });

  it("deleting leaves a tombstone: hidden from the picker, still resolvable for history", async () => {
    const { db, repos } = await setup();
    const created = await repos.exercises.create(input);
    await repos.exercises.remove(created.id);
    expect(await repos.exercises.listActive()).toEqual([]);
    const tombstone = await repos.exercises.get(created.id);
    expect(tombstone?.name).toBe("Landmine Press");
    expect(tombstone?.deleted_at).not.toBeNull();
    expect(tombstone?.updated_at).toBe(tombstone?.deleted_at);
    await expect(repos.exercises.update(created.id, input)).rejects.toThrow(NotFoundError);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("lists live exercises by name, case-insensitively", async () => {
    const { repos } = await setup();
    await repos.exercises.create({ ...input, name: "zercher squat" });
    await repos.exercises.create({ ...input, name: "Arnold Press" });
    await repos.exercises.create({ ...input, name: "belt squat" });
    expect((await repos.exercises.listActive()).map((e) => e.name)).toEqual([
      "Arnold Press",
      "belt squat",
      "zercher squat",
    ]);
  });

  it("marks written rows dirty for the next sync push", async () => {
    const { db, repos } = await setup();
    await repos.exercises.create(input);
    expect(await db.all("SELECT dirty FROM exercises")).toEqual([{ dirty: 1 }]);
  });

  it("listAll includes tombstones so routines and history can still name them", async () => {
    const { repos } = await setup();
    const kept = await repos.exercises.create(input);
    const gone = await repos.exercises.create({ ...input, name: "Gone" });
    await repos.exercises.remove(gone.id);
    expect((await repos.exercises.listAll()).map((e) => e.id).sort()).toEqual(
      [kept.id, gone.id].sort(),
    );
  });
});
