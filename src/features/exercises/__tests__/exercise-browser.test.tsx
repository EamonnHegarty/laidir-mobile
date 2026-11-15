import { fireEvent, render, screen } from "@testing-library/react-native";

import { ExerciseBrowser } from "../exercise-browser";
import { exerciseListItems } from "../model";

describe("ExerciseBrowser", () => {
  it("searches and reports the chosen exercise", async () => {
    const onSelect = jest.fn();
    await render(<ExerciseBrowser items={exerciseListItems([])} onSelect={onSelect} />);

    await fireEvent.changeText(screen.getByLabelText("Search exercises"), "db bench");
    await fireEvent.press(await screen.findByText("Bench Press (Dumbbell)"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "builtin:dumbbell-bench-press" }),
    );
  });

  it("shows an empty state when nothing matches", async () => {
    await render(<ExerciseBrowser items={exerciseListItems([])} onSelect={() => {}} />);
    await fireEvent.changeText(screen.getByLabelText("Search exercises"), "qqqq");
    expect(await screen.findByText("No exercises found")).toBeOnTheScreen();
  });
});
