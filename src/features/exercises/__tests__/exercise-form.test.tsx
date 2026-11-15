import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { draftToInput, ExerciseForm } from "../exercise-form";

describe("draftToInput", () => {
  const draft = {
    name: "Landmine Press",
    equipment: "barbell",
    primary_muscle: "shoulders",
    secondary_muscles: [],
    tracking: "weight_reps",
    notes: "",
  } as const;

  it("asks for what is missing", () => {
    expect(draftToInput({ ...draft, secondary_muscles: [], name: " " }).problem).toMatch(/name/);
    expect(draftToInput({ ...draft, secondary_muscles: [], equipment: undefined }).problem).toMatch(
      /equipment/,
    );
    expect(
      draftToInput({ ...draft, secondary_muscles: [], primary_muscle: undefined }).problem,
    ).toMatch(/muscle/);
  });

  it("drops the primary muscle from secondary muscles", () => {
    const { input } = draftToInput({ ...draft, secondary_muscles: ["shoulders", "triceps"] });
    expect(input?.secondary_muscles).toEqual(["triceps"]);
  });
});

describe("ExerciseForm", () => {
  it("submits a new exercise once name, equipment and muscle are chosen", async () => {
    const onSubmit = jest.fn(async () => {});
    await render(<ExerciseForm submitLabel="Create exercise" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("button", { name: "Create exercise" }));
    expect(await screen.findByText("Give the exercise a name.")).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText("Exercise name"), "Landmine Press");
    await fireEvent.press(screen.getByRole("button", { name: "Barbell" }));
    await fireEvent.press(screen.getAllByRole("button", { name: "Shoulders" })[0]!);
    await fireEvent.press(screen.getByRole("button", { name: "Create exercise" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "Landmine Press",
        equipment: "barbell",
        primary_muscle: "shoulders",
        secondary_muscles: [],
        tracking: "weight_reps",
        notes: "",
      }),
    );
  });

  it("shows a delete button only when editing", async () => {
    await render(
      <ExerciseForm
        initial={{
          name: "X",
          equipment: "cable",
          primary_muscle: "chest",
          tracking: "weight_reps",
        }}
        submitLabel="Save"
        onSubmit={async () => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Delete exercise" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Exercise name").props.value).toBe("X");
  });
});
