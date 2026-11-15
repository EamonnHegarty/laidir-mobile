import { relativeDay } from "../relative-day";

describe("relativeDay", () => {
  const now = new Date(2026, 10, 15, 9, 0); // 15 Nov 2026, 09:00 local
  const at = (y: number, m: number, d: number, h = 18) => new Date(y, m, d, h).toISOString();

  it("uses calendar days, not 24-hour blocks", () => {
    expect(relativeDay(at(2026, 10, 15, 7), now)).toBe("Today");
    expect(relativeDay(at(2026, 10, 14, 23), now)).toBe("Yesterday");
    expect(relativeDay(at(2026, 10, 12), now)).toBe("3 days ago");
  });

  it("shows a date after a week, with the year only when it differs", () => {
    expect(relativeDay(at(2026, 8, 10), now, "en-IE")).toBe("10 Sept");
    expect(relativeDay(at(2018, 8, 10), now, "en-IE")).toBe("10 Sept 2018");
  });
});
