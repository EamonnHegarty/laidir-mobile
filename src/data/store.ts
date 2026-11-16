import type { Entity, Exercise, Routine, RoutineFolder, Workout } from "./contract";
import type { Db, SqlValue } from "./db";

/** Which table holds each entity type, and the query columns copied out of its doc. */
type TableSpec<T extends Entity> = {
  table: string;
  columns: (doc: T) => Record<string, SqlValue>;
};

const base = (doc: Entity): Record<string, SqlValue> => ({
  id: doc.id,
  name: doc.name,
  created_at: doc.created_at,
  updated_at: doc.updated_at,
  deleted_at: doc.deleted_at,
});

export const tables = {
  EXERCISE: { table: "exercises", columns: base } satisfies TableSpec<Exercise>,
  ROUTINE_FOLDER: {
    table: "routine_folders",
    columns: (doc: RoutineFolder) => ({ ...base(doc), sort_order: doc.sort_order }),
  } satisfies TableSpec<RoutineFolder>,
  ROUTINE: {
    table: "routines",
    columns: (doc: Routine) => ({
      ...base(doc),
      folder_id: doc.folder_id ?? null,
      sort_order: doc.sort_order ?? null,
    }),
  } satisfies TableSpec<Routine>,
  WORKOUT: {
    table: "workouts",
    columns: (doc: Workout) => ({
      ...base(doc),
      routine_id: doc.routine_id ?? null,
      started_at: doc.started_at,
      ended_at: doc.ended_at ?? null,
    }),
  } satisfies TableSpec<Workout>,
} as const;

type SpecFor<T extends Entity> = TableSpec<T>;

function specOf<T extends Entity>(doc: T): SpecFor<T> {
  return tables[doc.type] as unknown as SpecFor<T>;
}

/**
 * Inserts or replaces an item. The doc is stored exactly as given (JSON drops undefined, so optional
 * fields stay absent, never null) and the row is marked dirty for the next sync push.
 */
export async function writeEntity<T extends Entity>(
  db: Db,
  doc: T,
  { dirty = true }: { dirty?: boolean } = {},
): Promise<void> {
  const { table, columns } = specOf(doc);
  // Local edits are dirty (to push); items written by sync from the server are clean.
  const cols = { ...columns(doc), dirty: dirty ? 1 : 0, doc: JSON.stringify(doc) };
  const names = Object.keys(cols);
  const placeholders = names.map(() => "?").join(", ");
  const updates = names
    .filter((n) => n !== "id")
    .map((n) => `${n} = excluded.${n}`)
    .join(", ");
  await db.run(
    `INSERT INTO ${table} (${names.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (id) DO UPDATE SET ${updates}`,
    Object.values(cols),
  );
}

type DocRow = { doc: string };

export const parseDocs = <T extends Entity>(rows: DocRow[]): T[] =>
  rows.map((r) => JSON.parse(r.doc) as T);

/** Reads one item by id, including tombstones. */
export async function readEntity<T extends Entity>(
  db: Db,
  type: T["type"],
  id: string,
): Promise<T | null> {
  const row = await db.first<DocRow>(`SELECT doc FROM ${tables[type].table} WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.doc) as T) : null;
}

/** Drops undefined values so optional contract fields are absent rather than undefined. */
export function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export class NotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`${type} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Trims a user-entered name and checks it against the contract's Name rule (1–100 chars). */
export function cleanName(name: string, what = "Name"): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new ValidationError(`${what} can't be empty`);
  if (trimmed.length > 100) throw new ValidationError(`${what} must be 100 characters or fewer`);
  return trimmed;
}

/** Gap between sort_order values, so a later move only rewrites the moved item. */
export const SORT_GAP = 1000;
