import { nextUpdatedAt } from "./clock";
import type { ExerciseRef, Timestamp, Workout, WorkoutExercise, WorkoutSet } from "./contract";
import { SCHEMA_VERSION } from "./contract";
import type { Db } from "./db";
import type { Deps } from "./deps";
import {
  cleanName,
  compact,
  NotFoundError,
  parseDocs,
  readEntity,
  ValidationError,
  writeEntity,
} from "./store";

export type WorkoutStart = {
  name: string;
  routine_id?: string;
  exercises?: WorkoutExercise[];
  /** Defaults to now. */
  started_at?: Timestamp;
};

export type WorkoutContent = {
  name: string;
  notes?: string;
  exercises: WorkoutExercise[];
};

/** One set from a finished workout, as stored in set_log. */
export type LoggedSet = {
  workout_id: string;
  performed_at: Timestamp;
  exercise_index: number;
  set_index: number;
  exercise_id: ExerciseRef;
} & WorkoutSet;

type SetLogRow = Omit<LoggedSet, "completed" | keyof WorkoutSet> & {
  set_type: WorkoutSet["set_type"];
  completed: number;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
};

const fromRow = (row: SetLogRow): LoggedSet =>
  compact({
    workout_id: row.workout_id,
    performed_at: row.performed_at,
    exercise_index: row.exercise_index,
    set_index: row.set_index,
    exercise_id: row.exercise_id,
    set_type: row.set_type,
    completed: row.completed === 1,
    weight_kg: row.weight_kg ?? undefined,
    reps: row.reps ?? undefined,
    duration_s: row.duration_s ?? undefined,
    distance_m: row.distance_m ?? undefined,
    rpe: row.rpe ?? undefined,
  });

/**
 * Keeps set_log in step with a workout: its rows are replaced on every write, and only finished,
 * live workouts have any.
 */
async function rebuildSetLog(tx: Db, workout: Workout): Promise<void> {
  await tx.run("DELETE FROM set_log WHERE workout_id = ?", [workout.id]);
  if (workout.deleted_at !== null || workout.ended_at === undefined) return;
  for (const [exerciseIndex, exercise] of workout.exercises.entries()) {
    for (const [setIndex, set] of exercise.sets.entries()) {
      await tx.run(
        `INSERT INTO set_log (workout_id, exercise_index, set_index, exercise_id, performed_at,
           set_type, completed, weight_kg, reps, duration_s, distance_m, rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workout.id,
          exerciseIndex,
          setIndex,
          exercise.exercise_id,
          workout.started_at,
          set.set_type,
          set.completed ? 1 : 0,
          set.weight_kg ?? null,
          set.reps ?? null,
          set.duration_s ?? null,
          set.distance_m ?? null,
          set.rpe ?? null,
        ],
      );
    }
  }
}

/** Logged workouts. The one with no ended_at is in progress; it's saved on every change. */
export function workoutsRepo({ db, clock, newId }: Deps) {
  async function write(tx: Db, doc: Workout) {
    await writeEntity(tx, doc);
    await rebuildSetLog(tx, doc);
  }

  async function liveWorkout(tx: Db, id: string) {
    const workout = await readEntity<Workout>(tx, "WORKOUT", id);
    if (!workout || workout.deleted_at !== null) throw new NotFoundError("Workout", id);
    return workout;
  }

  async function active(tx: Db): Promise<Workout | null> {
    const row = await tx.first<{ doc: string }>(
      `SELECT doc FROM workouts WHERE deleted_at IS NULL AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
    );
    return row ? (JSON.parse(row.doc) as Workout) : null;
  }

  return {
    /** Includes tombstones. */
    get(id: string): Promise<Workout | null> {
      return readEntity<Workout>(db, "WORKOUT", id);
    },

    /** The in-progress workout, if any. */
    getActive(): Promise<Workout | null> {
      return active(db);
    },

    /** Finished workouts, newest first. Pass the last item's started_at as `before` for the next page. */
    async listHistory({ limit = 20, before }: { limit?: number; before?: Timestamp } = {}) {
      return parseDocs<Workout>(
        await db.all(
          `SELECT doc FROM workouts
           WHERE deleted_at IS NULL AND ended_at IS NOT NULL AND (? IS NULL OR started_at < ?)
           ORDER BY started_at DESC LIMIT ?`,
          [before ?? null, before ?? null, limit],
        ),
      );
    },

    /** When each Workout template was last started, from finished sessions (routine id → started_at). */
    async lastDoneByRoutine(): Promise<Map<string, Timestamp>> {
      const rows = await db.all<{ routine_id: string; last: Timestamp }>(
        `SELECT routine_id, MAX(started_at) AS last FROM workouts
         WHERE deleted_at IS NULL AND ended_at IS NOT NULL AND routine_id IS NOT NULL
         GROUP BY routine_id`,
      );
      return new Map(rows.map((row) => [row.routine_id, row.last]));
    },

    /** Starts a workout. Only one can be in progress. */
    async start(input: WorkoutStart): Promise<Workout> {
      return db.transaction(async (tx) => {
        if (await active(tx)) throw new ValidationError("A workout is already in progress");
        const now = clock.now();
        const doc: Workout = compact({
          id: newId(),
          type: "WORKOUT",
          schema_version: SCHEMA_VERSION,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          name: cleanName(input.name, "Workout name"),
          routine_id: input.routine_id,
          started_at: input.started_at ?? now,
          exercises: input.exercises ?? [],
        });
        await write(tx, doc);
        return doc;
      });
    },

    /** Replaces the editable content (in progress or editing a finished workout from history). */
    async save(id: string, content: WorkoutContent): Promise<Workout> {
      return db.transaction(async (tx) => {
        const current = await liveWorkout(tx, id);
        const doc: Workout = compact({
          ...current,
          updated_at: nextUpdatedAt(clock, current.updated_at),
          name: cleanName(content.name, "Workout name"),
          notes: content.notes?.trim() ? content.notes.trim() : undefined,
          exercises: content.exercises,
        });
        await write(tx, doc);
        return doc;
      });
    },

    async finish(id: string, endedAt?: Timestamp): Promise<Workout> {
      return db.transaction(async (tx) => {
        const current = await liveWorkout(tx, id);
        if (current.ended_at !== undefined) return current;
        const ended = endedAt ?? clock.now();
        if (ended < current.started_at)
          throw new ValidationError("A workout can't end before it starts");
        const doc: Workout = {
          ...current,
          ended_at: ended,
          updated_at: nextUpdatedAt(clock, current.updated_at),
        };
        await write(tx, doc);
        return doc;
      });
    },

    /** Deletes a finished workout, or discards the one in progress. */
    async remove(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const current = await readEntity<Workout>(tx, "WORKOUT", id);
        if (!current || current.deleted_at !== null) return;
        const at = nextUpdatedAt(clock, current.updated_at);
        await write(tx, { ...current, updated_at: at, deleted_at: at });
      });
    },

    /**
     * Sets of the most recent finished workout that included this exercise, in order. Drives the
     * "previous" column when logging.
     */
    async lastPerformance(exerciseId: ExerciseRef): Promise<LoggedSet[]> {
      const rows = await db.all<SetLogRow>(
        `SELECT * FROM set_log
         WHERE exercise_id = ?1 AND workout_id = (
           SELECT workout_id FROM set_log WHERE exercise_id = ?1
           ORDER BY performed_at DESC LIMIT 1)
         ORDER BY exercise_index, set_index`,
        [exerciseId],
      );
      return rows.map(fromRow);
    },

    /** This exercise's sets from its most recent finished workouts, newest first, grouped by workout. */
    async exerciseHistory(
      exerciseId: ExerciseRef,
      { limit = 20 }: { limit?: number } = {},
    ): Promise<ExerciseSession[]> {
      const rows = await db.all<SetLogRow & { workout_name: string }>(
        `SELECT s.*, w.name AS workout_name
         FROM set_log s JOIN workouts w ON w.id = s.workout_id
         WHERE s.exercise_id = ?1 AND s.workout_id IN (
           SELECT workout_id FROM set_log WHERE exercise_id = ?1
           GROUP BY workout_id ORDER BY MAX(performed_at) DESC LIMIT ?2)
         ORDER BY s.performed_at DESC, s.workout_id, s.exercise_index, s.set_index`,
        [exerciseId, limit],
      );
      const sessions: ExerciseSession[] = [];
      for (const row of rows) {
        let session = sessions.at(-1);
        if (session?.workout_id !== row.workout_id) {
          session = {
            workout_id: row.workout_id,
            workout_name: row.workout_name,
            performed_at: row.performed_at,
            sets: [],
          };
          sessions.push(session);
        }
        session.sets.push(fromRow(row));
      }
      return sessions;
    },
  };
}

export type ExerciseSession = {
  workout_id: string;
  workout_name: string;
  performed_at: Timestamp;
  sets: LoggedSet[];
};

export type WorkoutsRepo = ReturnType<typeof workoutsRepo>;
