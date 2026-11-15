import type { SQLiteDatabase } from "expo-sqlite";

import type { Db, SqlValue } from "./db";

/**
 * Adapts an expo-sqlite database to Db. Transactions use withExclusiveTransactionAsync, so queries
 * running elsewhere in the app can't leak into (or be rolled back with) a transaction. It opens a
 * separate connection, so nothing here relies on per-connection PRAGMAs such as foreign_keys.
 */
export function expoDb(sqlite: SQLiteDatabase, inTransaction = false): Db {
  const db: Db = {
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params = []) => {
      await sqlite.runAsync(sql, params as SqlValue[]);
    },
    all: (sql, params = []) => sqlite.getAllAsync(sql, params as SqlValue[]),
    first: (sql, params = []) => sqlite.getFirstAsync(sql, params as SqlValue[]),
    transaction: async (fn) => {
      if (inTransaction) return fn(db);
      let result: Awaited<ReturnType<typeof fn>> | undefined;
      await sqlite.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(expoDb(txn, true));
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
  };
  return db;
}
