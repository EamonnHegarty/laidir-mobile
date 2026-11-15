import {
  durationInput,
  formatRepRange,
  parseDecimal,
  parseDuration,
  parseRepRange,
  parseWhole,
} from "../parse";

describe("parse", () => {
  it("parses decimals with a dot or a comma", () => {
    expect(parseDecimal("102.5")).toBe(102.5);
    expect(parseDecimal("102,5")).toBe(102.5);
    expect(parseDecimal(".5")).toBe(0.5);
    expect(parseDecimal("  ")).toBeUndefined();
    expect(parseDecimal("-5")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });

  it("parses whole numbers", () => {
    expect(parseWhole("8")).toBe(8);
    expect(parseWhole("8.5")).toBeNull();
    expect(parseWhole("")).toBeUndefined();
  });

  it("parses rep ranges in the ways people type them", () => {
    expect(parseRepRange("8")).toEqual({ min: 8, max: 8 });
    expect(parseRepRange("6-8")).toEqual({ min: 6, max: 8 });
    expect(parseRepRange("6 – 8")).toEqual({ min: 6, max: 8 });
    expect(parseRepRange("8 to 12")).toEqual({ min: 8, max: 12 });
    expect(parseRepRange("12-8")).toEqual({ min: 8, max: 12 });
    expect(parseRepRange("")).toEqual({});
    expect(parseRepRange("6-")).toBeNull();
    expect(parseRepRange("a")).toBeNull();
  });

  it("formats rep ranges back", () => {
    expect(formatRepRange({ min: 8, max: 8 })).toBe("8");
    expect(formatRepRange({ min: 6, max: 8 })).toBe("6–8");
    expect(formatRepRange({})).toBe("");
  });

  it("parses and formats durations", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration("")).toBeUndefined();
    expect(parseDuration("1:x")).toBeNull();
    expect(durationInput(90)).toBe("1:30");
    expect(durationInput(45)).toBe("0:45");
    expect(durationInput(3725)).toBe("1:02:05");
    expect(durationInput(undefined)).toBe("");
  });
});
