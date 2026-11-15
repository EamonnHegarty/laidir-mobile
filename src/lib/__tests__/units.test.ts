import {
  displayNumber,
  estimatedOneRepMax,
  formatDistance,
  formatDuration,
  formatWeight,
  kgToUnit,
  unitToKg,
} from "../units";

describe("units", () => {
  it("round-trips lb entries exactly enough to show what was typed", () => {
    for (const lb of [45, 135, 185, 225, 2.5, 317.5]) {
      expect(displayNumber(kgToUnit(unitToKg(lb, "lb"), "lb"))).toBe(String(lb));
    }
  });

  it("formats weights with at most two decimals and no trailing zeros", () => {
    expect(formatWeight(102.5, "kg")).toBe("102.5 kg");
    expect(formatWeight(100, "kg")).toBe("100 kg");
    expect(formatWeight(61.25, "kg")).toBe("61.25 kg");
    expect(formatWeight(100, "lb")).toBe("220.46 lb");
    expect(formatWeight(unitToKg(185, "lb"), "lb")).toBe("185 lb");
  });

  it("estimates 1RM with Epley", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimatedOneRepMax(100, 0)).toBeUndefined();
  });

  it("formats durations and distances", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDistance(400, "km")).toBe("400 m");
    expect(formatDistance(5000, "km")).toBe("5 km");
    expect(formatDistance(1609.344, "mi")).toBe("1 mi");
  });
});
