import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import type { RoutineFolder } from "@/data/contract";

import { addExercises, emptyDraft, type RoutineDraft } from "../draft";
import { RoutineEditor } from "../routine-editor";

const folder: RoutineFolder = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "ROUTINE_FOLDER",
  schema_version: 1,
  created_at: "2026-11-15T09:00:00.000Z",
  updated_at: "2026-11-15T09:00:00.000Z",
  deleted_at: null,
  name: "Push/Pull/Legs",
  sort_order: 1000,
};

function Harness({
  onDraft,
  units = { weight_unit: "kg", distance_unit: "km" } as const,
}: {
  onDraft: (d: RoutineDraft) => void;
  units?: { weight_unit: "kg" | "lb"; distance_unit: "km" | "mi" };
}) {
  const [draft, setDraft] = useState(addExercises(emptyDraft(), ["builtin:barbell-bench-press"]));
  return (
    <RoutineEditor
      draft={draft}
      onChange={(next) => {
        setDraft(next);
        onDraft(next);
      }}
      folders={[folder]}
      customExercises={new Map()}
      units={units}
      onAddExercises={() => {}}
    />
  );
}

describe("RoutineEditor", () => {
  it("edits name, folder, set type and targets", async () => {
    const onDraft = jest.fn();
    await render(<Harness onDraft={onDraft} />);
    const last = () => onDraft.mock.calls.at(-1)![0] as RoutineDraft;

    await fireEvent.changeText(screen.getByLabelText("Routine name"), "Push");
    await fireEvent.press(screen.getByRole("button", { name: "Push/Pull/Legs" }));
    expect(last()).toMatchObject({ name: "Push", folder_id: folder.id });

    // First set: make it a warm-up.
    await fireEvent.press(screen.getByLabelText("Working set 1. Change to Warm-up"));
    expect(last().exercises[0]!.sets[0]!.set_type).toBe("warmup");

    // Second set (now working set 1): reps range and weight, committed when editing ends.
    const reps = screen.getByLabelText("Target reps, set 1, Bench Press (Barbell)");
    await fireEvent(reps, "focus");
    await fireEvent.changeText(reps, "6-8");
    await fireEvent(reps, "endEditing");
    const weight = screen.getByLabelText("Target weight in kg, set 1, Bench Press (Barbell)");
    await fireEvent(weight, "focus");
    await fireEvent.changeText(weight, "82,5");
    await fireEvent(weight, "endEditing");
    expect(last().exercises[0]!.sets[1]).toEqual({
      set_type: "normal",
      target_reps_min: 6,
      target_reps_max: 8,
      target_weight_kg: 82.5,
    });
  });

  it("stores lb targets as kg and ignores input it can't read", async () => {
    const onDraft = jest.fn();
    await render(<Harness onDraft={onDraft} units={{ weight_unit: "lb", distance_unit: "mi" }} />);
    const weight = screen.getByLabelText("Target weight in lb, set 1, Bench Press (Barbell)");
    await fireEvent(weight, "focus");
    await fireEvent.changeText(weight, "185");
    await fireEvent(weight, "endEditing");
    expect(onDraft.mock.calls.at(-1)![0].exercises[0].sets[0].target_weight_kg).toBeCloseTo(
      83.91,
      2,
    );
    expect(weight.props.value).toBe("185");

    const calls = onDraft.mock.calls.length;
    await fireEvent(weight, "focus");
    await fireEvent.changeText(weight, "heavy");
    await fireEvent(weight, "endEditing");
    expect(onDraft.mock.calls.length).toBe(calls);
    expect(weight.props.value).toBe("185");
  });

  it("adds and removes sets and exercises", async () => {
    const onDraft = jest.fn();
    await render(<Harness onDraft={onDraft} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add set" }));
    expect(onDraft.mock.calls.at(-1)![0].exercises[0].sets).toHaveLength(4);
    await fireEvent.press(screen.getByLabelText("Remove Bench Press (Barbell)"));
    expect(onDraft.mock.calls.at(-1)![0].exercises).toEqual([]);
  });
});
