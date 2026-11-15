import { fireEvent, render, screen } from "@testing-library/react-native";

import { LogSetRow } from "../set-row";

const units = { weight_unit: "lb", distance_unit: "km" } as const;

describe("LogSetRow", () => {
  it("shows hints in empty fields and reports typed values in kg", async () => {
    const onChange = jest.fn();
    await render(
      <LogSetRow
        number={1}
        set={{ set_type: "normal", completed: false }}
        tracking="weight_reps"
        hint={{ weight_kg: 100, reps: 5 }}
        previous="220.46 lb × 5"
        units={units}
        exerciseName="Squat"
        onChange={onChange}
        onToggle={() => {}}
        onRemove={() => {}}
      />,
    );
    const weight = screen.getByLabelText("Weight in lb, set 1, Squat");
    expect(weight.props.placeholder).toBe("220.46");
    expect(screen.getByLabelText("Reps, set 1, Squat").props.placeholder).toBe("5");
    expect(screen.getByText("220.46 lb × 5")).toBeOnTheScreen();

    await fireEvent(weight, "focus");
    await fireEvent.changeText(weight, "225");
    expect(onChange.mock.calls.at(-1)![0].weight_kg).toBeCloseTo(102.06, 2);
    await fireEvent.changeText(weight, "22x");
    expect(onChange).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(weight, "");
    expect(onChange.mock.calls.at(-1)![0]).toEqual({ weight_kg: undefined });
  });

  it("ticks and cycles the set type", async () => {
    const onChange = jest.fn();
    const onToggle = jest.fn();
    await render(
      <LogSetRow
        number={2}
        set={{ set_type: "normal", completed: false }}
        tracking="reps_only"
        hint={{}}
        units={units}
        exerciseName="Pull-up"
        onChange={onChange}
        onToggle={onToggle}
        onRemove={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/Weight/)).toBeNull();
    await fireEvent.press(screen.getByLabelText("Done, set 2, Pull-up"));
    expect(onToggle).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Working set 2. Change to Warm-up"));
    expect(onChange).toHaveBeenCalledWith({ set_type: "warmup" });
  });
});
