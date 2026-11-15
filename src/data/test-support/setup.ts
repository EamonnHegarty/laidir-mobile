import { createRepositories } from "../index";
import { migrate } from "../migrations";
import type { Clock } from "../clock";
import { nodeDb } from "./node-db";

/** A clock tests can set and advance. */
export function testClock(start = "2026-11-15T09:00:00.000Z") {
  let current = Date.parse(start);
  const clock: Clock & { set(t: string): void; advance(ms: number): void } = {
    now: () => new Date(current).toISOString(),
    set: (t) => {
      current = Date.parse(t);
    },
    advance: (ms) => {
      current += ms;
    },
  };
  return clock;
}

/** Sequential, valid lowercase v4-shaped UUIDs. */
export function testIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, "0")}`;
}

export async function setup() {
  const db = nodeDb();
  await migrate(db);
  const clock = testClock();
  const repos = createRepositories({ db, clock, newId: testIds() });
  return { db, clock, repos };
}
