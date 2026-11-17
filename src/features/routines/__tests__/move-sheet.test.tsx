import { fireEvent, render, screen } from "@testing-library/react-native";

import type { RoutineFolder } from "@/data/contract";

import { MoveSheet } from "../move-sheet";

const folder = (id: string, name: string): RoutineFolder => ({
  id,
  type: "ROUTINE_FOLDER",
  schema_version: 1,
  created_at: "2026-11-17T10:00:00.000Z",
  updated_at: "2026-11-17T10:00:00.000Z",
  deleted_at: null,
  name,
  sort_order: 1000,
});

const FOLDERS = [folder("f1", "Push Pull Legs"), folder("f2", "Upper Lower")];

function renderSheet(currentFolderId?: string) {
  const onMove = jest.fn();
  const onCreateAndMove = jest.fn();
  const onClose = jest.fn();
  const view = render(
    <MoveSheet
      workoutName="Push"
      folders={FOLDERS}
      currentFolderId={currentFolderId}
      onMove={onMove}
      onCreateAndMove={onCreateAndMove}
      onClose={onClose}
    />,
  );
  return { view, onMove, onCreateAndMove, onClose };
}

describe("MoveSheet", () => {
  it("moves to another program, or out of any", async () => {
    const { view, onMove, onClose } = renderSheet("f1");
    await view;
    expect(screen.getByLabelText("Push Pull Legs, current")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Move to Upper Lower"));
    expect(onMove).toHaveBeenCalledWith("f2");
    expect(onClose).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Move to No program"));
    expect(onMove).toHaveBeenLastCalledWith(undefined);
  });

  it("does nothing when you pick where it already is", async () => {
    const { view, onMove } = renderSheet(undefined);
    await view;
    await fireEvent.press(screen.getByLabelText("No program, current"));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("creates a new program and moves it there", async () => {
    const { view, onCreateAndMove } = renderSheet("f1");
    await view;
    await fireEvent.press(screen.getByRole("button", { name: "New program…" }));
    await fireEvent.changeText(screen.getByLabelText("New program name"), "  Strength  ");
    await fireEvent.press(screen.getByRole("button", { name: "Create and move Push" }));
    expect(onCreateAndMove).toHaveBeenCalledWith("Strength");
  });
});
