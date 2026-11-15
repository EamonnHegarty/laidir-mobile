import { setup } from "../test-support/setup";

describe("stats, display name and backup", () => {
  it("lists finished workouts and their sets in time order, from a date", async () => {
    const { clock, repos } = await setup();
    const ids: string[] = [];
    for (const weight_kg of [100, 105]) {
      const w = await repos.workouts.start({
        name: `Squat ${weight_kg}`,
        exercises: [
          {
            exercise_id: "builtin:barbell-back-squat",
            sets: [{ set_type: "normal", weight_kg, reps: 5, completed: true }],
          },
        ],
      });
      await repos.workouts.finish(w.id);
      ids.push(w.id);
      clock.advance(86_400_000);
    }
    await repos.workouts.start({ name: "In progress" });

    const all = await repos.stats.workouts();
    expect(all.map((w) => w.id)).toEqual(ids);
    const sets = await repos.stats.sets();
    expect(sets.map((s) => s.weight_kg)).toEqual([100, 105]);

    const since = all[1]!.started_at;
    expect((await repos.stats.workouts({ since })).map((w) => w.id)).toEqual([ids[1]]);
    expect((await repos.stats.sets({ since })).map((s) => s.weight_kg)).toEqual([105]);
  });

  it("stores the display name trimmed, and clears it", async () => {
    const { repos } = await setup();
    expect(await repos.settings.displayName()).toBeUndefined();
    await repos.settings.setDisplayName("  Eamonn ");
    expect(await repos.settings.displayName()).toBe("Eamonn");
    await expect(repos.settings.setDisplayName("x".repeat(51))).rejects.toThrow(RangeError);
    await repos.settings.setDisplayName("");
    expect(await repos.settings.displayName()).toBeUndefined();
  });

  it("exports every stored item and the settings", async () => {
    const { repos } = await setup();
    const folder = await repos.routines.createFolder("PPL");
    await repos.settings.update({ weight_unit: "lb" });
    const backup = await repos.backup.export();
    expect(backup.app).toBe("laidir");
    expect(backup.items).toContainEqual(folder);
    expect(backup.settings).toMatchObject({ weight_unit: "lb" });
  });
});

describe("accent", () => {
  it("defaults to Glas, stores a choice, and ignores unknown values", async () => {
    const { repos, db } = await setup();
    expect(await repos.settings.accent()).toBe("glas");
    await repos.settings.setAccent("corcra");
    expect(await repos.settings.accent()).toBe("corcra");
    await db.run("UPDATE settings SET value = ? WHERE key = 'local_accent'", ['"neon"']);
    expect(await repos.settings.accent()).toBe("glas");
  });
});
