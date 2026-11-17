import { nextUpdatedAt } from "./clock";
import type { Routine, RoutineExercise, RoutineFolder } from "./contract";
import { SCHEMA_VERSION } from "./contract";
import type { Db } from "./db";
import type { Deps } from "./deps";
import {
  cleanName,
  compact,
  NotFoundError,
  parseDocs,
  readEntity,
  SORT_GAP,
  writeEntity,
} from "./store";

export type RoutineInput = {
  name: string;
  notes?: string;
  /** Absent = unfiled. */
  folder_id?: string;
  exercises: RoutineExercise[];
};

/** Where a workout sits: its program (absent = none) and position. */
export type Placement = { folder_id?: string; sort_order?: number };

export type RoutineGroup = { folder: RoutineFolder; routines: Routine[] };
export type GroupedRoutines = { folders: RoutineGroup[]; unfiled: Routine[] };

const ORDER = "ORDER BY sort_order, name COLLATE NOCASE, created_at";

async function nextSortOrder(db: Db, table: string, where: string, params: string[] = []) {
  const row = await db.first<{ max: number | null }>(
    `SELECT MAX(sort_order) AS max FROM ${table} WHERE deleted_at IS NULL AND ${where}`,
    params,
  );
  return (row?.max ?? 0) + SORT_GAP;
}

const nextRoutineSortOrder = (db: Db, folderId: string | undefined) =>
  folderId === undefined
    ? nextSortOrder(db, "routines", "folder_id IS NULL")
    : nextSortOrder(db, "routines", "folder_id = ?", [folderId]);

/** Routines and the folders that group them (e.g. "Push/Pull/Legs" → Push, Pull, Legs). */
export function routinesRepo({ db, clock, newId }: Deps) {
  async function liveFolder(tx: Db, id: string) {
    const folder = await readEntity<RoutineFolder>(tx, "ROUTINE_FOLDER", id);
    if (!folder || folder.deleted_at !== null) throw new NotFoundError("Program", id);
    return folder;
  }

  async function liveRoutine(tx: Db, id: string) {
    const routine = await readEntity<Routine>(tx, "ROUTINE", id);
    if (!routine || routine.deleted_at !== null) throw new NotFoundError("Workout", id);
    return routine;
  }

  return {
    // ---- folders ----

    async listFolders(): Promise<RoutineFolder[]> {
      return parseDocs(
        await db.all(`SELECT doc FROM routine_folders WHERE deleted_at IS NULL ${ORDER}`),
      );
    },

    async createFolder(name: string): Promise<RoutineFolder> {
      return db.transaction(async (tx) => {
        const now = clock.now();
        const doc: RoutineFolder = {
          id: newId(),
          type: "ROUTINE_FOLDER",
          schema_version: SCHEMA_VERSION,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          name: cleanName(name, "Program name"),
          sort_order: await nextSortOrder(tx, "routine_folders", "1 = 1"),
        };
        await writeEntity(tx, doc);
        return doc;
      });
    },

    async renameFolder(id: string, name: string): Promise<RoutineFolder> {
      return db.transaction(async (tx) => {
        const current = await liveFolder(tx, id);
        const doc: RoutineFolder = {
          ...current,
          name: cleanName(name, "Program name"),
          updated_at: nextUpdatedAt(clock, current.updated_at),
        };
        await writeEntity(tx, doc);
        return doc;
      });
    },

    /**
     * Deletes a folder but keeps its routines: the folder is tombstoned and each of its routines is
     * rewritten without folder_id (the contract's folder-delete rule), all in one transaction.
     */
    async removeFolder(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const folder = await readEntity<RoutineFolder>(tx, "ROUTINE_FOLDER", id);
        if (!folder || folder.deleted_at !== null) return;
        const at = nextUpdatedAt(clock, folder.updated_at);
        await writeEntity(tx, { ...folder, updated_at: at, deleted_at: at });

        const routines = parseDocs<Routine>(
          await tx.all(
            `SELECT doc FROM routines WHERE deleted_at IS NULL AND folder_id = ? ${ORDER}`,
            [id],
          ),
        );
        let sortOrder = await nextRoutineSortOrder(tx, undefined);
        for (const routine of routines) {
          const { folder_id: _removed, ...rest } = routine;
          await writeEntity(tx, {
            ...rest,
            sort_order: sortOrder,
            updated_at: nextUpdatedAt(clock, routine.updated_at),
          });
          sortOrder += SORT_GAP;
        }
      });
    },

    // ---- routines ----

    /**
     * Folders in order, each with its routines, plus unfiled routines. A routine whose folder_id
     * points at a missing or deleted folder counts as unfiled (sync isn't atomic across items).
     */
    async listGrouped(): Promise<GroupedRoutines> {
      const folders = await this.listFolders();
      const routines = parseDocs<Routine>(
        await db.all(`SELECT doc FROM routines WHERE deleted_at IS NULL ${ORDER}`),
      );
      const groups = new Map(
        folders.map((folder) => [folder.id, { folder, routines: [] as Routine[] }]),
      );
      const unfiled: Routine[] = [];
      for (const routine of routines) {
        const group = routine.folder_id === undefined ? undefined : groups.get(routine.folder_id);
        if (group) group.routines.push(routine);
        else unfiled.push(routine);
      }
      return { folders: [...groups.values()], unfiled };
    },

    /** Includes tombstones (a workout's routine_id may point at a deleted routine). */
    get(id: string): Promise<Routine | null> {
      return readEntity<Routine>(db, "ROUTINE", id);
    },

    async create(input: RoutineInput): Promise<Routine> {
      return db.transaction(async (tx) => {
        if (input.folder_id !== undefined) await liveFolder(tx, input.folder_id);
        const now = clock.now();
        const doc: Routine = compact({
          id: newId(),
          type: "ROUTINE",
          schema_version: SCHEMA_VERSION,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          name: cleanName(input.name, "Workout name"),
          notes: input.notes?.trim() ? input.notes.trim() : undefined,
          folder_id: input.folder_id,
          sort_order: await nextRoutineSortOrder(tx, input.folder_id),
          exercises: input.exercises,
        });
        await writeEntity(tx, doc);
        return doc;
      });
    },

    /**
     * Puts a program's workouts (or the unfiled ones, `folderId` undefined) in the given order.
     * Rewrites sort_order with fresh gaps; only workouts whose position changed are saved (and
     * synced). Ids not in that group are ignored; workouts left out keep their place after these.
     */
    async reorder(folderId: string | undefined, orderedIds: readonly string[]): Promise<void> {
      await db.transaction(async (tx) => {
        const routines = parseDocs<Routine>(
          await tx.all(
            folderId === undefined
              ? `SELECT doc FROM routines WHERE deleted_at IS NULL AND folder_id IS NULL ${ORDER}`
              : `SELECT doc FROM routines WHERE deleted_at IS NULL AND folder_id = ? ${ORDER}`,
            folderId === undefined ? [] : [folderId],
          ),
        );
        const byId = new Map(routines.map((r) => [r.id, r]));
        const listed = orderedIds.filter((id) => byId.has(id));
        const rest = routines.filter((r) => !listed.includes(r.id)).map((r) => r.id);
        let sortOrder = SORT_GAP;
        for (const id of [...listed, ...rest]) {
          const routine = byId.get(id)!;
          if (routine.sort_order !== sortOrder) {
            await writeEntity(tx, {
              ...routine,
              sort_order: sortOrder,
              updated_at: nextUpdatedAt(clock, routine.updated_at),
            });
          }
          sortOrder += SORT_GAP;
        }
      });
    },

    /** Replaces the editable fields. Moving to another folder puts the routine at the end of it. */
    async update(id: string, input: RoutineInput): Promise<Routine> {
      return db.transaction(async (tx) => {
        const current = await liveRoutine(tx, id);
        if (input.folder_id !== undefined) await liveFolder(tx, input.folder_id);
        const moved = input.folder_id !== current.folder_id;
        const doc: Routine = compact({
          id: current.id,
          type: current.type,
          schema_version: current.schema_version,
          created_at: current.created_at,
          updated_at: nextUpdatedAt(clock, current.updated_at),
          deleted_at: null,
          name: cleanName(input.name, "Workout name"),
          notes: input.notes?.trim() ? input.notes.trim() : undefined,
          folder_id: input.folder_id,
          sort_order: moved ? await nextRoutineSortOrder(tx, input.folder_id) : current.sort_order,
          exercises: input.exercises,
        });
        await writeEntity(tx, doc);
        return doc;
      });
    },

    /**
     * Moves a workout into a program (`folderId`), or out of any (`undefined`), at the end of it.
     * Returns where it was, so the move can be undone with `place`. Moving to where it already is
     * changes nothing.
     */
    async move(id: string, folderId: string | undefined): Promise<Placement> {
      return db.transaction(async (tx) => {
        const current = await liveRoutine(tx, id);
        const before: Placement = { folder_id: current.folder_id, sort_order: current.sort_order };
        if (folderId === current.folder_id) return before;
        if (folderId !== undefined) await liveFolder(tx, folderId);
        const { folder_id: _old, ...rest } = current;
        await writeEntity(
          tx,
          compact({
            ...rest,
            folder_id: folderId,
            sort_order: await nextRoutineSortOrder(tx, folderId),
            updated_at: nextUpdatedAt(clock, current.updated_at),
          }),
        );
        return before;
      });
    },

    /** Puts a workout back exactly where `move` found it (Undo). A deleted program means none. */
    async place(id: string, placement: Placement): Promise<void> {
      await db.transaction(async (tx) => {
        const current = await liveRoutine(tx, id);
        let folderId = placement.folder_id;
        if (folderId !== undefined) {
          const folder = await readEntity<RoutineFolder>(tx, "ROUTINE_FOLDER", folderId);
          if (!folder || folder.deleted_at !== null) folderId = undefined;
        }
        const { folder_id: _old, sort_order: _order, ...rest } = current;
        await writeEntity(
          tx,
          compact({
            ...rest,
            folder_id: folderId,
            sort_order: placement.sort_order,
            updated_at: nextUpdatedAt(clock, current.updated_at),
          }),
        );
      });
    },

    async remove(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const current = await readEntity<Routine>(tx, "ROUTINE", id);
        if (!current || current.deleted_at !== null) return;
        const at = nextUpdatedAt(clock, current.updated_at);
        await writeEntity(tx, { ...current, updated_at: at, deleted_at: at });
      });
    },
  };
}

export type RoutinesRepo = ReturnType<typeof routinesRepo>;
