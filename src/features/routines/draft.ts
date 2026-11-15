import type { ExerciseRef, Routine, RoutineExercise, RoutineSet } from "@/data/contract";
import type { RoutineInput } from "@/data/routines";

/** Contract limits (schemas/v1/common.json). */
export const MAX_EXERCISES = 50;
export const MAX_SETS = 30;
const DEFAULT_SETS = 3;

/** The routine editor's working copy. Saved through routines.create/update. */
export type RoutineDraft = {
  name: string;
  notes: string;
  folder_id?: string;
  exercises: RoutineExercise[];
};

export function emptyDraft(folderId?: string): RoutineDraft {
  return { name: "", notes: "", folder_id: folderId, exercises: [] };
}

export function draftFromRoutine(routine: Routine): RoutineDraft {
  return {
    name: routine.name,
    notes: routine.notes ?? "",
    folder_id: routine.folder_id,
    exercises: JSON.parse(JSON.stringify(routine.exercises)) as RoutineExercise[],
  };
}

export function draftToInput(draft: RoutineDraft): { input?: RoutineInput; problem?: string } {
  if (!draft.name.trim()) return { problem: "Give the workout a name." };
  return {
    input: {
      name: draft.name,
      notes: draft.notes,
      folder_id: draft.folder_id,
      exercises: draft.exercises,
    },
  };
}

/** Appends exercises, each with a few empty working sets (and the default rest time). */
export function addExercises(
  draft: RoutineDraft,
  refs: readonly ExerciseRef[],
  restSeconds?: number,
): RoutineDraft {
  const room = MAX_EXERCISES - draft.exercises.length;
  const added = refs.slice(0, Math.max(0, room)).map((exercise_id): RoutineExercise => ({
    exercise_id,
    ...(restSeconds === undefined ? {} : { rest_seconds: restSeconds }),
    sets: Array.from({ length: DEFAULT_SETS }, () => ({ set_type: "normal" as const })),
  }));
  return { ...draft, exercises: [...draft.exercises, ...added] };
}

export function removeExercise(draft: RoutineDraft, index: number): RoutineDraft {
  return { ...draft, exercises: draft.exercises.filter((_, i) => i !== index) };
}

/** Moves an exercise one place up (-1) or down (+1). Out-of-range moves do nothing. */
export function moveExercise(draft: RoutineDraft, index: number, by: -1 | 1): RoutineDraft {
  const target = index + by;
  if (target < 0 || target >= draft.exercises.length) return draft;
  const exercises = [...draft.exercises];
  [exercises[index], exercises[target]] = [exercises[target]!, exercises[index]!];
  return { ...draft, exercises };
}

/** Sets a field on one exercise; undefined removes it (contract: optional fields are absent). */
export function updateExercise(
  draft: RoutineDraft,
  index: number,
  changes: Partial<Pick<RoutineExercise, "rest_seconds" | "notes">>,
): RoutineDraft {
  return mapExercise(draft, index, (exercise) => withChanges<RoutineExercise>(exercise, changes));
}

/** Adds a set copying the last one's type and targets, so ladders are quick to build. */
export function addSet(draft: RoutineDraft, index: number): RoutineDraft {
  return mapExercise(draft, index, (exercise) => {
    if (exercise.sets.length >= MAX_SETS) return exercise;
    const last = exercise.sets.at(-1) ?? { set_type: "normal" };
    return { ...exercise, sets: [...exercise.sets, { ...last }] };
  });
}

/** Removes a set. The last remaining set stays (a routine exercise needs at least one). */
export function removeSet(draft: RoutineDraft, index: number, setIndex: number): RoutineDraft {
  return mapExercise(draft, index, (exercise) =>
    exercise.sets.length <= 1
      ? exercise
      : { ...exercise, sets: exercise.sets.filter((_, i) => i !== setIndex) },
  );
}

export function updateSet(
  draft: RoutineDraft,
  index: number,
  setIndex: number,
  changes: Partial<RoutineSet>,
): RoutineDraft {
  return mapExercise(draft, index, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, i) => (i === setIndex ? withChanges(set, changes) : set)),
  }));
}

function mapExercise(
  draft: RoutineDraft,
  index: number,
  fn: (exercise: RoutineExercise) => RoutineExercise,
): RoutineDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise, i) => (i === index ? fn(exercise) : exercise)),
  };
}

function withChanges<T extends object>(value: T, changes: Partial<T>): T {
  const next = { ...value } as Record<string, unknown>;
  for (const [key, change] of Object.entries(changes)) {
    if (change === undefined) delete next[key];
    else next[key] = change;
  }
  return next as T;
}

/** "3 sets · 8–12 reps" style summary of one routine exercise. */
export function setSummary(exercise: RoutineExercise): string {
  const count = exercise.sets.length;
  const working = exercise.sets.filter((s) => s.set_type !== "warmup");
  const ranges = new Set(
    working
      .filter((s) => s.target_reps_min !== undefined || s.target_reps_max !== undefined)
      .map((s) =>
        s.target_reps_min === s.target_reps_max || s.target_reps_max === undefined
          ? `${s.target_reps_min ?? s.target_reps_max}`
          : `${s.target_reps_min ?? 0}–${s.target_reps_max}`,
      ),
  );
  const sets = `${count} ${count === 1 ? "set" : "sets"}`;
  return ranges.size === 1 ? `${sets} · ${[...ranges][0]} reps` : sets;
}
