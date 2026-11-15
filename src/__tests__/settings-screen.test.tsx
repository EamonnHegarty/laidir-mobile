import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/app/profile/settings";
import { RepositoriesProvider } from "@/data/database-provider";
import type { Repositories } from "@/data/index";
import { createChangeFeed } from "@/data/live";
import { DEFAULT_SETTINGS, type Settings } from "@/data/settings";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-file-system", () => ({}));
jest.mock("expo-sharing", () => ({}));

/** Just enough of the repositories for the Settings screen, kept in memory. */
function fakeRepositories() {
  const changes = createChangeFeed();
  let stored: Settings = { ...DEFAULT_SETTINGS };
  let name: string | undefined;
  let accent = "glas";
  const settings = {
    displayName: async () => name,
    setDisplayName: async (next: string | null) => {
      name = next?.trim() || undefined;
      changes.notify();
    },
    exerciseRest: async () => new Map([["builtin:bench-press", 90]]),
    accent: async () => accent,
    setAccent: async (next: string) => {
      accent = next;
      changes.notify();
    },
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
    name: () => name,
    accent: () => accent,
  };
}

describe("Settings screen", () => {
  it("switches units, default rest and display name, and saves them", async () => {
    const fake = fakeRepositories();
    await render(
      <RepositoriesProvider value={fake.value}>
        <SettingsScreen />
      </RepositoriesProvider>,
    );

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
    expect(screen.getByRole("button", { name: /Per-exercise rest/ })).toHaveTextContent(/1/);

    const field = screen.getByLabelText("Display name");
    await fireEvent(field, "focus");
    await fireEvent.changeText(field, " Eamonn ");
    await fireEvent(field, "endEditing");
    expect(fake.name()).toBe("Eamonn");

    expect(screen.getByRole("radio", { name: "Glas, Green" })).toBeChecked();
    await fireEvent.press(screen.getByRole("radio", { name: "Farraige, Sea blue" }));
    expect(fake.accent()).toBe("farraige");
    expect(
      await screen.findByRole("radio", { name: "Farraige, Sea blue", checked: true }),
    ).toBeOnTheScreen();
  });
});
