import type { Db } from "./db";

/**
 * Append-only list of schema migrations. migrations[i] takes the database from version i to i + 1
 * (stored in PRAGMA user_version). Never edit or reorder a released migration; add a new one.
 *
 * Storage shape: one table per synced entity type. `doc` holds the exact v1 contract item as JSON
 * (what phase 3 sync pushes and pulls). The other columns are copies of fields from `doc`, kept for
 * indexing and queries, and are rewritten whenever `doc` is. `dirty` = changed locally since the last
 * sync push (unused until phase 3).
 */
export const migrations: readonly string[] = [
  // 1: initial schema
  `
  CREATE TABLE exercises (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty      INTEGER NOT NULL DEFAULT 1,
    doc        TEXT NOT NULL
  ) STRICT;

  CREATE TABLE routine_folders (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty      INTEGER NOT NULL DEFAULT 1,
    doc        TEXT NOT NULL
  ) STRICT;

  -- folder_id has no foreign key on purpose: sync isn't atomic, so it may point at a folder that
  -- hasn't arrived yet or was deleted. Readers treat that as unfiled.
  CREATE TABLE routines (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    folder_id  TEXT,
    sort_order INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty      INTEGER NOT NULL DEFAULT 1,
    doc        TEXT NOT NULL
  ) STRICT;
  CREATE INDEX routines_by_folder ON routines (folder_id) WHERE deleted_at IS NULL;

  CREATE TABLE workouts (
    id         TEXT PRIMARY KEY NOT NULL,
    name       TEXT NOT NULL,
    routine_id TEXT,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty      INTEGER NOT NULL DEFAULT 1,
    doc        TEXT NOT NULL
  ) STRICT;
  CREATE INDEX workouts_history ON workouts (started_at DESC)
    WHERE deleted_at IS NULL AND ended_at IS NOT NULL;
  CREATE INDEX workouts_active ON workouts (started_at DESC)
    WHERE deleted_at IS NULL AND ended_at IS NULL;

  -- Derived from workouts.doc: one row per set of every finished, live workout. Rebuilt in the same
  -- transaction as each workout write. Powers exercise history, previous values and records.
  CREATE TABLE set_log (
    workout_id     TEXT NOT NULL,
    exercise_index INTEGER NOT NULL,
    set_index      INTEGER NOT NULL,
    exercise_id    TEXT NOT NULL,
    performed_at   TEXT NOT NULL,
    set_type       TEXT NOT NULL,
    completed      INTEGER NOT NULL,
    weight_kg      REAL,
    reps           INTEGER,
    duration_s     INTEGER,
    distance_m     REAL,
    rpe            REAL,
    PRIMARY KEY (workout_id, exercise_index, set_index)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX set_log_by_exercise ON set_log (exercise_id, performed_at DESC);

  -- Local preferences, shaped like Profile fields (they become the Profile item at first login).
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  ) STRICT;
  `,
];

export const SCHEMA_DB_VERSION = migrations.length;

/** Brings the database up to the latest version. Safe to run on every app start. */
export async function migrate(db: Db): Promise<void> {
  // WAL can't be switched inside a transaction. In-memory test databases ignore it.
  await db.exec("PRAGMA journal_mode = WAL;");

  const current =
    (await db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? 0;
  if (current > migrations.length) {
    throw new Error(
      `Database is at version ${current} but this app only knows ${migrations.length}. ` +
        "It was opened by a newer build; install the latest app.",
    );
  }

  for (let version = current; version < migrations.length; version++) {
    const sql = migrations[version];
    if (sql === undefined) throw new Error(`Missing migration ${version + 1}`);
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.exec(`PRAGMA user_version = ${version + 1};`);
    });
  }
}
