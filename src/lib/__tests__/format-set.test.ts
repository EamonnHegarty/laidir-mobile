import { formatSet } from "../format-set";
import { unitToKg } from "../units";

const kg = { weight_unit: "kg", distance_unit: "km" } as const;
const lb = { weight_unit: "lb", distance_unit: "mi" } as const;

describe("formatSet", () => {
  it("formats each tracking type", () => {
    expect(formatSet({ weight_kg: 100, reps: 5 }, "weight_reps", kg)).toBe("100 kg × 5");
    expect(formatSet({ weight_kg: unitToKg(185, "lb"), reps: 5 }, "weight_reps", lb)).toBe(
      "185 lb × 5",
    );
    expect(formatSet({ reps: 12 }, "reps_only", kg)).toBe("12 reps");
    expect(formatSet({ reps: 1 }, "reps_only", kg)).toBe("1 rep");
    expect(formatSet({ weight_kg: 20, reps: 8 }, "weighted_bodyweight", kg)).toBe("+20 kg × 8");
    expect(formatSet({ weight_kg: 20, reps: 8 }, "assisted_bodyweight", kg)).toBe("−20 kg × 8");
    expect(formatSet({ duration_s: 90 }, "duration", kg)).toBe("1:30");
    expect(formatSet({ distance_m: 2000, duration_s: 600 }, "distance_duration", kg)).toBe(
      "2 km · 10:00",
    );
    expect(formatSet({ weight_kg: 40, distance_m: 20 }, "weight_distance", kg)).toBe(
      "40 kg · 20 m",
    );
  });

  it("adds RPE and handles empty sets", () => {
    expect(formatSet({ weight_kg: 100, reps: 5, rpe: 8.5 }, "weight_reps", kg)).toBe(
      "100 kg × 5 @ RPE 8.5",
    );
    expect(formatSet({}, "weight_reps", kg)).toBe("—");
  });
});
