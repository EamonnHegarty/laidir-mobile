import type { Db } from "./db";

/**
 * A counter bumped after every committed write. Screens re-run their queries when it changes, so
 * any edit (anywhere in the app) refreshes whatever is showing.
 */
export function createChangeFeed() {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    version: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify() {
      version++;
      for (const listener of listeners) listener();
    },
  };
}

export type ChangeFeed = ReturnType<typeof createChangeFeed>;

/**
 * Wraps a Db so the feed is notified once each top-level write or transaction has committed.
 * Statements inside a transaction run on the inner (unwrapped) handle, so they don't notify early.
 */
export function notifyingDb(db: Db, feed: ChangeFeed): Db {
  return {
    exec: async (sql) => {
      await db.exec(sql);
      feed.notify();
    },
    run: async (sql, params) => {
      await db.run(sql, params);
      feed.notify();
    },
    all: (sql, params) => db.all(sql, params),
    first: (sql, params) => db.first(sql, params),
    transaction: async (fn) => {
      const result = await db.transaction(fn);
      feed.notify();
      return result;
    },
  };
}
