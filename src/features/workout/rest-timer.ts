import { useSyncExternalStore } from "react";

/**
 * The rest timer between sets. It stores the end time rather than counting down, so it stays right
 * when the app is backgrounded or the screen re-renders late. Only one runs at a time.
 */
export type RestTimer = { endsAt: number; total: number } | null;

export function createRestTimer(now: () => number = Date.now) {
  let state: RestTimer = null;
  const listeners = new Set<() => void>();
  const set = (next: RestTimer) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start(seconds: number) {
      if (seconds <= 0) return set(null);
      set({ endsAt: now() + seconds * 1000, total: seconds });
    },
    /** Adds (or with a negative value, removes) time. Going to zero stops it. */
    adjust(seconds: number) {
      if (!state) return;
      const endsAt = state.endsAt + seconds * 1000;
      if (endsAt <= now()) return set(null);
      set({ endsAt, total: Math.max(1, state.total + seconds) });
    },
    stop: () => set(null),
    /** Whole seconds left, rounded up; 0 when finished or not running. */
    remaining(): number {
      return state ? Math.max(0, Math.ceil((state.endsAt - now()) / 1000)) : 0;
    },
  };
}

export const restTimer = createRestTimer();

export function useRestTimer(): RestTimer {
  return useSyncExternalStore(restTimer.subscribe, restTimer.get);
}
