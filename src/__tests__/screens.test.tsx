import { render, screen } from "@testing-library/react-native";

import HistoryScreen from "@/app/history";
import SettingsScreen from "@/app/settings";

describe.each([
  ["History", HistoryScreen],
  ["Settings", SettingsScreen],
])("%s tab", (title, Screen) => {
  it("renders its heading", async () => {
    await render(<Screen />);
    expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
  });
});
