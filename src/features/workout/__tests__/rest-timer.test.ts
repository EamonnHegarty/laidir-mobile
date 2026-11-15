import { createRestTimer } from "../rest-timer";

describe("rest timer", () => {
  it("counts down from the end time, adjusts and stops", () => {
    let now = 1_000_000;
    const timer = createRestTimer(() => now);
    timer.start(90);
    expect(timer.remaining()).toBe(90);
    now += 30_500;
    expect(timer.remaining()).toBe(60);
    timer.adjust(15);
    expect(timer.remaining()).toBe(75);
    timer.adjust(-100);
    expect(timer.get()).toBeNull();
    timer.start(0);
    expect(timer.get()).toBeNull();
  });

  it("notifies subscribers", () => {
    const timer = createRestTimer(() => 0);
    const seen: (number | undefined)[] = [];
    timer.subscribe(() => seen.push(timer.get()?.total));
    timer.start(60);
    timer.stop();
    expect(seen).toEqual([60, undefined]);
  });
});
