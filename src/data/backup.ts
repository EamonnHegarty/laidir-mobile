import type { Db } from "./db";

const TABLES = ["exercises", "routine_folders", "routines", "workouts"] as const;

export type Backup = {
  app: "laidir";
  format: 1;
  exported_at: string;
  /** Every stored v1 item, tombstones included, exactly as it would sync. */
  items: unknown[];
  /** Local preferences, keyed by their Profile field names. */
  settings: Record<string, unknown>;
};

/** A full export of the local data, until phase 3 sync backs it up. */
export function backupRepo({ db, clock }: { db: Db; clock: { now: () => string } }) {
  return {
    async export(): Promise<Backup> {
      const items: unknown[] = [];
      for (const table of TABLES) {
        const rows = await db.all<{ doc: string }>(`SELECT doc FROM ${table} ORDER BY created_at`);
        for (const row of rows) items.push(JSON.parse(row.doc));
      }
      const settings: Record<string, unknown> = {};
      for (const row of await db.all<{ key: string; value: string }>(
        "SELECT key, value FROM settings ORDER BY key",
      )) {
        settings[row.key] = JSON.parse(row.value);
      }
      return { app: "laidir", format: 1, exported_at: clock.now(), items, settings };
    },
  };
}
