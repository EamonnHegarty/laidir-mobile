import type { RoutineExercise } from "../contract";
import { NotFoundError } from "../store";
import { storedProblems } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

const bench: RoutineExercise = {
  exercise_id: "builtin:barbell-bench-press",
  rest_seconds: 120,
  sets: [
    { set_type: "warmup", target_reps_min: 10, target_reps_max: 10, target_weight_kg: 40 },
    { set_type: "normal", target_reps_min: 6, target_reps_max: 8, target_weight_kg: 80 },
  ],
};

describe("routine folders", () => {
  it("groups routines into folders in sort order, with unfiled routines separate", async () => {
    const { db, repos } = await setup();
    const ppl = await repos.routines.createFolder("Push/Pull/Legs");
    const upperLower = await repos.routines.createFolder("Upper/Lower");
    await repos.routines.create({ name: "Push", folder_id: ppl.id, exercises: [bench] });
    await repos.routines.create({ name: "Pull", folder_id: ppl.id, exercises: [] });
    await repos.routines.create({ name: "Legs", folder_id: ppl.id, exercises: [] });
    await repos.routines.create({ name: "Upper A", folder_id: upperLower.id, exercises: [] });
    await repos.routines.create({ name: "Chest & Bis", exercises: [bench] });

    const grouped = await repos.routines.listGrouped();
    expect(grouped.folders.map((g) => [g.folder.name, g.routines.map((r) => r.name)])).toEqual([
      ["Push/Pull/Legs", ["Push", "Pull", "Legs"]],
      ["Upper/Lower", ["Upper A"]],
    ]);
    expect(grouped.unfiled.map((r) => r.name)).toEqual(["Chest & Bis"]);
    expect([ppl.sort_order, upperLower.sort_order]).toEqual([1000, 2000]);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("deleting a folder tombstones it and unfiles its routines", async () => {
    const { db, repos } = await setup();
    const folder = await repos.routines.createFolder("PPL");
    const push = await repos.routines.create({ name: "Push", folder_id: folder.id, exercises: [] });
    await repos.routines.create({ name: "Solo", exercises: [] });

    await repos.routines.removeFolder(folder.id);

    expect(await repos.routines.listFolders()).toEqual([]);
    const after = await repos.routines.get(push.id);
    expect(after).not.toHaveProperty("folder_id");
    expect(after!.updated_at > push.updated_at).toBe(true);
    const grouped = await repos.routines.listGrouped();
    expect(grouped.unfiled.map((r) => r.name)).toEqual(["Solo", "Push"]);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("treats a folder_id pointing at a deleted or missing folder as unfiled", async () => {
    const { db, repos } = await setup();
    const folder = await repos.routines.createFolder("PPL");
    const push = await repos.routines.create({ name: "Push", folder_id: folder.id, exercises: [] });
    // Sync delivered the folder's tombstone but not the routine update yet...
    await db.run("UPDATE routine_folders SET deleted_at = updated_at");
    expect((await repos.routines.listGrouped()).unfiled.map((r) => r.id)).toEqual([push.id]);
    // ...or the routine arrived before its folder.
    await db.run("DELETE FROM routine_folders");
    expect((await repos.routines.listGrouped()).unfiled.map((r) => r.id)).toEqual([push.id]);
  });

  it("will not file a routine into a deleted folder", async () => {
    const { repos } = await setup();
    const folder = await repos.routines.createFolder("Old");
    await repos.routines.removeFolder(folder.id);
    await expect(
      repos.routines.create({ name: "Push", folder_id: folder.id, exercises: [] }),
    ).rejects.toThrow(NotFoundError);
  });

  it("renames a folder", async () => {
    const { repos } = await setup();
    const folder = await repos.routines.createFolder("PPL");
    const renamed = await repos.routines.renameFolder(folder.id, " Push Pull Legs ");
    expect(renamed.name).toBe("Push Pull Legs");
    expect(renamed.updated_at > folder.updated_at).toBe(true);
  });
});

describe("routines", () => {
  it("creates a valid v1 Routine with target sets", async () => {
    const { db, repos } = await setup();
    const routine = await repos.routines.create({
      name: "Chest & Bis",
      notes: "",
      exercises: [bench],
    });
    expect(routine).toMatchObject({ type: "ROUTINE", name: "Chest & Bis", sort_order: 1000 });
    expect(routine).not.toHaveProperty("notes");
    expect(routine).not.toHaveProperty("folder_id");
    expect(await storedProblems(db)).toEqual([]);
  });

  it("moving a routine to another folder appends it there", async () => {
    const { db, repos } = await setup();
    const a = await repos.routines.createFolder("A");
    const b = await repos.routines.createFolder("B");
    await repos.routines.create({ name: "B1", folder_id: b.id, exercises: [] });
    const r = await repos.routines.create({ name: "R", folder_id: a.id, exercises: [] });
    const moved = await repos.routines.update(r.id, { name: "R", folder_id: b.id, exercises: [] });
    expect(moved.sort_order).toBe(2000);
    const renamed = await repos.routines.update(r.id, {
      name: "R2",
      folder_id: b.id,
      exercises: [],
    });
    expect(renamed.sort_order).toBe(2000);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("deleting a routine leaves a tombstone that get() still returns", async () => {
    const { repos } = await setup();
    const r = await repos.routines.create({ name: "R", exercises: [] });
    await repos.routines.remove(r.id);
    expect((await repos.routines.listGrouped()).unfiled).toEqual([]);
    expect((await repos.routines.get(r.id))?.deleted_at).not.toBeNull();
  });
});

describe("reorder", () => {
  it("puts a program's workouts in the given order and only saves the ones that moved", async () => {
    const { repos } = await setup();
    const folder = await repos.routines.createFolder("Upper/Lower");
    const names = ["Lower A", "Upper A", "Lower B"];
    const created = [];
    for (const name of names) {
      created.push(await repos.routines.create({ name, folder_id: folder.id, exercises: [] }));
    }
    const [lowerA, upperA, lowerB] = created;
    await repos.routines.reorder(folder.id, [lowerA!.id, lowerB!.id, upperA!.id]);

    const grouped = await repos.routines.listGrouped();
    expect(grouped.folders[0]!.routines.map((r) => r.name)).toEqual([
      "Lower A",
      "Lower B",
      "Upper A",
    ]);
    expect((await repos.routines.get(lowerA!.id))!.updated_at).toBe(lowerA!.updated_at);
    expect((await repos.routines.get(lowerB!.id))!.updated_at > lowerB!.updated_at).toBe(true);
  });
});
