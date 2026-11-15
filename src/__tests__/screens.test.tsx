import { render, screen } from "@testing-library/react-native";

import HistoryScreen from "@/app/history";
import WorkoutScreen from "@/app/index";
import RoutinesScreen from "@/app/routines";
import SettingsScreen from "@/app/settings";

describe.each([
  ["Workout", WorkoutScreen],
  ["History", HistoryScreen],
  ["Routines", RoutinesScreen],
  ["Settings", SettingsScreen],
])("%s tab", (title, Screen) => {
  it("renders its heading", async () => {
    await render(<Screen />);
    expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
  });
});
