/**
 * The small slice of SQLite the data layer uses. The app backs it with expo-sqlite (see expo-db.ts);
 * tests back it with node:sqlite, so repositories and migrations run against real SQLite in Jest.
 */
export type SqlValue = string | number | null;

export interface Db {
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /**
   * Runs `fn` in a transaction: all of its writes commit together or not at all. Only statements made
   * through `tx` are part of it. Calling `transaction` on `tx` again just runs inside the same one.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
