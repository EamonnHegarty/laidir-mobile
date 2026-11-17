import { fireEvent, render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/app/profile/settings";
import { RepositoriesProvider } from "@/data/database-provider";
import type { Repositories } from "@/data/index";
import { createChangeFeed } from "@/data/live";
import { DEFAULT_SETTINGS, type Settings } from "@/data/settings";
import type { SyncController } from "@/sync/controller";
import { SyncControllerProvider } from "@/sync/sync-provider";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("expo-file-system", () => ({}));
jest.mock("expo-sharing", () => ({}));
const mockPlay = jest.fn();
jest.mock("expo-audio", () => ({
  setAudioModeAsync: async () => {},
  createAudioPlayer: () => ({ play: mockPlay, pause: () => {}, seekTo: async () => {} }),
}));

/** Just enough of the repositories for the Settings screen, kept in memory. */
function fakeRepositories() {
  const changes = createChangeFeed();
  let stored: Settings = { ...DEFAULT_SETTINGS };
  let name: string | undefined;
  let accent = "glas";
  let restAlert = "both";
  let restSound = "beeps";
  const settings = {
    displayName: async () => name,
    setDisplayName: async (next: string | null) => {
      name = next?.trim() || undefined;
      changes.notify();
    },
    appearance: async () => "system",
    restAlert: async () => restAlert,
    setRestAlert: async (next: string) => {
      restAlert = next;
      changes.notify();
    },
    workoutReminder: async () => true,
    restRingOnSilent: async () => true,
    restSound: async () => restSound,
    setRestSound: async (next: string) => {
      restSound = next;
      changes.notify();
    },
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
    restAlert: () => restAlert,
    restSound: () => restSound,
  };
}

/** A signed-out sync controller whose sign-in is recorded. */
function fakeSync() {
  const signIn = jest.fn(async () => undefined);
  const state = { kind: "signed-out" } as const; // stable, like the real controller's
  const controller = {
    getState: () => state,
    subscribe: () => () => undefined,
    signIn,
  } as unknown as SyncController;
  return { controller, signIn };
}

function renderSettings(fake: ReturnType<typeof fakeRepositories>, sync = fakeSync()) {
  return render(
    <RepositoriesProvider value={fake.value}>
      <SyncControllerProvider controller={sync.controller}>
        <SettingsScreen />
      </SyncControllerProvider>
    </RepositoriesProvider>,
  );
}

describe("Settings screen", () => {
  it("offers optional sign-in to back up", async () => {
    const sync = fakeSync();
    await renderSettings(fakeRepositories(), sync);
    await fireEvent.press(await screen.findByRole("button", { name: /Sign in to back up/ }));
    expect(sync.signIn).toHaveBeenCalled();
  });

  it("picks the rest sound and plays it as a preview", async () => {
    const fake = fakeRepositories();
    await renderSettings(fake);
    expect(await screen.findByRole("button", { name: "Beeps" })).toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: "Boxing bell" }));
    expect(fake.restSound()).toBe("bell");
    expect(await screen.findByRole("button", { name: "Boxing bell" })).toBeSelected();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockPlay).toHaveBeenCalled();
  });

  it("switches units, default rest and display name, and saves them", async () => {
    const fake = fakeRepositories();
    await renderSettings(fake);

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
    expect(screen.queryByText(/Per-exercise rest/)).toBeNull();

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

    await fireEvent.press(screen.getByRole("button", { name: "Vibration" }));
    expect(fake.restAlert()).toBe("vibrate");
  });
});
