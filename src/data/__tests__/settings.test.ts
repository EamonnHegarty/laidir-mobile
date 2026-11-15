import { DEFAULT_SETTINGS } from "../settings";
import { profileFieldErrors } from "../test-support/contract-validator";
import { setup } from "../test-support/setup";

describe("settings", () => {
  it("starts with defaults and persists changes", async () => {
    const { repos } = await setup();
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
    await repos.settings.update({ weight_unit: "lb" });
    expect(await repos.settings.get()).toEqual({ ...DEFAULT_SETTINGS, weight_unit: "lb" });
  });

  it("remembers a rest time per exercise without touching the main settings", async () => {
    const { db, repos } = await setup();
    await repos.settings.setExerciseRest("builtin:leg-press", 180);
    await repos.settings.setExerciseRest("builtin:barbell-curl", 60);
    await repos.settings.setExerciseRest("builtin:leg-press", 150);
    expect(await repos.settings.exerciseRest()).toEqual(
      new Map([
        ["builtin:leg-press", 150],
        ["builtin:barbell-curl", 60],
      ]),
    );
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);

    // Stored as Profile.exercise_rest_seconds, ready to become the Profile at first login.
    const [row] = await db.all<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'exercise_rest_seconds'",
    );
    expect(profileFieldErrors("exercise_rest_seconds", JSON.parse(row!.value))).toEqual([]);
    expect(profileFieldErrors("exercise_rest_seconds", { "not-a-ref": 60 })).not.toEqual([]);

    await repos.settings.setExerciseRest("builtin:leg-press", null);
    expect(await repos.settings.exerciseRest()).toEqual(new Map([["builtin:barbell-curl", 60]]));
    await expect(repos.settings.setExerciseRest("builtin:leg-press", 4000)).rejects.toThrow(
      RangeError,
    );
  });

  it("ignores unknown stored keys", async () => {
    const { db, repos } = await setup();
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ["legacy", "1"]);
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
  });
});
