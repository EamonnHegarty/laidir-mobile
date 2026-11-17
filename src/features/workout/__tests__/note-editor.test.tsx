import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NoteEditor } from "../note-editor";

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const inSafeArea = (ui: ReactElement) => (
  <SafeAreaProvider initialMetrics={METRICS}>{ui}</SafeAreaProvider>
);

describe("NoteEditor", () => {
  it("saves the edited note and closes", async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    await render(
      inSafeArea(
        <NoteEditor
          exerciseName="Bench Press"
          initial="seat on 4"
          onSave={onSave}
          onClose={onClose}
        />,
      ),
    );
    const field = screen.getByLabelText("Note for Bench Press");
    expect(field).toHaveDisplayValue("seat on 4");

    await fireEvent.changeText(field, "seat on 5, pause reps");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("seat on 5, pause reps");
    expect(onClose).toHaveBeenCalled();
  });

  it("leaves the note unchanged on Cancel", async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    await render(
      inSafeArea(<NoteEditor exerciseName="Squat" initial="" onSave={onSave} onClose={onClose} />),
    );

    await fireEvent.changeText(screen.getByLabelText("Note for Squat"), "draft");
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
