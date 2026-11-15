import type { Timestamp } from "./contract";
import type { Db } from "./db";
import { fromSetLogRow, type LoggedSet, type SetLogRow } from "./workouts";

/** A finished workout, reduced to what the stats need. */
export type WorkoutSummary = {
  id: string;
  name: string;
  routine_id?: string;
  started_at: Timestamp;
  ended_at: Timestamp;
};

/**
 * Read-only queries behind the Profile stats, PR badges and charts. All of it is derived from the
 * finished, live workouts (set_log only has rows for those).
 */
export function statsRepo({ db }: { db: Db }) {
  return {
    /** Finished workouts, oldest first, optionally from `since` on. */
    async workouts({ since }: { since?: Timestamp } = {}): Promise<WorkoutSummary[]> {
      const rows = await db.all<{
        id: string;
        name: string;
        routine_id: string | null;
        started_at: Timestamp;
        ended_at: Timestamp;
      }>(
        `SELECT id, name, routine_id, started_at, ended_at FROM workouts
         WHERE deleted_at IS NULL AND ended_at IS NOT NULL AND (?1 IS NULL OR started_at >= ?1)
         ORDER BY started_at`,
        [since ?? null],
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        started_at: r.started_at,
        ended_at: r.ended_at,
        ...(r.routine_id === null ? {} : { routine_id: r.routine_id }),
      }));
    },

    /** Every logged set, oldest first (then in workout order), optionally from `since` on. */
    async sets({ since }: { since?: Timestamp } = {}): Promise<LoggedSet[]> {
      const rows = await db.all<SetLogRow>(
        `SELECT * FROM set_log WHERE (?1 IS NULL OR performed_at >= ?1)
         ORDER BY performed_at, workout_id, exercise_index, set_index`,
        [since ?? null],
      );
      return rows.map(fromSetLogRow);
    },
  };
}

export type StatsRepo = ReturnType<typeof statsRepo>;
