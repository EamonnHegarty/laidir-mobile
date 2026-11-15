import { render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/app/settings";

describe.each([["Settings", SettingsScreen]])("%s tab", (title, Screen) => {
  it("renders its heading", async () => {
    await render(<Screen />);
    expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
  });
});
