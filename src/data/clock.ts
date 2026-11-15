import type { Timestamp } from "./contract";

/** Injected so tests control time and IDs. */
export interface Clock {
  /** Current time as an ISO-8601 UTC timestamp with exactly 3 fractional digits. */
  now(): Timestamp;
}

export const systemClock: Clock = {
  // toISOString always gives YYYY-MM-DDTHH:mm:ss.sssZ, the contract's Timestamp format.
  now: () => new Date().toISOString(),
};

/**
 * A new updated_at for an item last updated at `previous`. Always strictly later than `previous`,
 * even if the clock hasn't moved or went backwards, because sync resolves conflicts by
 * last-writer-wins on updated_at and an equal value would be rejected as stale.
 */
export function nextUpdatedAt(clock: Clock, previous?: Timestamp): Timestamp {
  const now = clock.now();
  if (previous === undefined || now > previous) return now;
  return new Date(Date.parse(previous) + 1).toISOString();
}
