// Db backed by Node's built-in SQLite, so the data layer runs against real SQLite in Jest.
import { DatabaseSync } from "node:sqlite";

import type { Db, SqlValue } from "../db";

export function nodeDb(sqlite = new DatabaseSync(":memory:")): Db & { sqlite: DatabaseSync } {
  let depth = 0;
  const db: Db & { sqlite: DatabaseSync } = {
    sqlite,
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    run: async (sql, params: readonly SqlValue[] = []) => {
      sqlite.prepare(sql).run(...params);
    },
    all: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      sqlite.prepare(sql).all(...params) as T[],
    first: async <T>(sql: string, params: readonly SqlValue[] = []) =>
      (sqlite.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: async (fn) => {
      if (depth > 0) return fn(db);
      depth++;
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(db);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
  };
  return db;
}
