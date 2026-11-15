import { nextUpdatedAt } from "./clock";
import type { Exercise } from "./contract";
import { SCHEMA_VERSION } from "./contract";
import type { Deps } from "./deps";
import { cleanName, compact, NotFoundError, parseDocs, readEntity, writeEntity } from "./store";

/** The user-editable fields of a custom exercise. */
export type ExerciseInput = Pick<Exercise, "name" | "equipment" | "primary_muscle" | "tracking"> &
  Partial<Pick<Exercise, "secondary_muscles" | "notes">>;

function content(input: ExerciseInput) {
  return compact({
    name: cleanName(input.name, "Exercise name"),
    equipment: input.equipment,
    primary_muscle: input.primary_muscle,
    secondary_muscles: input.secondary_muscles?.length ? input.secondary_muscles : undefined,
    tracking: input.tracking,
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
  });
}

/**
 * The user's custom exercises (built-ins come from catalogue.ts). Deleting one leaves a tombstone:
 * workouts and routines still reference its UUID, so `get` keeps resolving it (history shows its
 * name) while `listActive` hides it from pickers.
 */
export function exercisesRepo({ db, clock, newId }: Deps) {
  return {
    async listActive(): Promise<Exercise[]> {
      return parseDocs<Exercise>(
        await db.all(
          "SELECT doc FROM exercises WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, created_at",
        ),
      );
    },

    /** Includes tombstones. */
    get(id: string): Promise<Exercise | null> {
      return readEntity<Exercise>(db, "EXERCISE", id);
    },

    async create(input: ExerciseInput): Promise<Exercise> {
      const now = clock.now();
      const doc: Exercise = {
        id: newId(),
        type: "EXERCISE",
        schema_version: SCHEMA_VERSION,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        ...content(input),
      };
      await writeEntity(db, doc);
      return doc;
    },

    /** Replaces the editable fields. Omitted optional fields are removed. */
    async update(id: string, input: ExerciseInput): Promise<Exercise> {
      return db.transaction(async (tx) => {
        const current = await readEntity<Exercise>(tx, "EXERCISE", id);
        if (!current || current.deleted_at !== null) throw new NotFoundError("Exercise", id);
        const doc: Exercise = {
          id: current.id,
          type: current.type,
          schema_version: current.schema_version,
          created_at: current.created_at,
          updated_at: nextUpdatedAt(clock, current.updated_at),
          deleted_at: null,
          ...content(input),
        };
        await writeEntity(tx, doc);
        return doc;
      });
    },

    async remove(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const current = await readEntity<Exercise>(tx, "EXERCISE", id);
        if (!current || current.deleted_at !== null) return;
        const at = nextUpdatedAt(clock, current.updated_at);
        await writeEntity(tx, { ...current, updated_at: at, deleted_at: at });
      });
    },
  };
}

export type ExercisesRepo = ReturnType<typeof exercisesRepo>;
