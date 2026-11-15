import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/app/settings";
import { RepositoriesProvider } from "@/data/database-provider";
import type { Repositories } from "@/data/index";
import { createChangeFeed } from "@/data/live";
import { DEFAULT_SETTINGS, type Settings } from "@/data/settings";

/** Just enough of the repositories for the Settings screen, kept in memory. */
function fakeRepositories() {
  const changes = createChangeFeed();
  let stored: Settings = { ...DEFAULT_SETTINGS };
  const settings = {
    get: async () => stored,
    update: async (patch: Partial<Settings>) => {
      stored = { ...stored, ...patch };
      changes.notify();
      return stored;
    },
  };
  return {
    value: { repositories: { settings } as unknown as Repositories, changes },
    stored: () => stored,
  };
}

describe("Settings screen", () => {
  it("switches units and default rest, and saves them", async () => {
    const fake = fakeRepositories();
    await render(
      <RepositoriesProvider value={fake.value}>
        <SettingsScreen />
      </RepositoriesProvider>,
    );

    expect(screen.getByRole("header", { name: "Settings" })).toBeOnTheScreen();
    const kg = await screen.findByRole("button", { name: "Kilograms (kg)" });
    expect(kg).toBeSelected();

    await fireEvent.press(screen.getByRole("button", { name: "Pounds (lb)" }));
    await fireEvent.press(screen.getByRole("button", { name: "Miles" }));
    await fireEvent.press(screen.getByRole("button", { name: "3:00" }));

    expect(fake.stored()).toEqual({
      weight_unit: "lb",
      distance_unit: "mi",
      default_rest_seconds: 180,
    });
    expect(
      await screen.findByRole("button", { name: "Pounds (lb)", selected: true }),
    ).toBeOnTheScreen();
  });
});
