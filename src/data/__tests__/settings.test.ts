import { DEFAULT_SETTINGS } from "../settings";
import { setup } from "../test-support/setup";

describe("settings", () => {
  it("starts with defaults and persists changes", async () => {
    const { repos } = await setup();
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
    await repos.settings.update({ weight_unit: "lb" });
    expect(await repos.settings.get()).toEqual({ ...DEFAULT_SETTINGS, weight_unit: "lb" });
  });

  it("ignores unknown stored keys", async () => {
    const { db, repos } = await setup();
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ["legacy", "1"]);
    expect(await repos.settings.get()).toEqual(DEFAULT_SETTINGS);
  });
});
