import type {
  ExerciseRef,
  Routine,
  RoutineExercise,
  SetType,
  Tracking,
  WorkoutExercise,
  WorkoutSet,
} from "@/data/contract";
import type { LoggedSet } from "@/data/workouts";

/** Contract limits (schemas/v1/common.json, Workout.json). */
export const MAX_EXERCISES = 50;
export const MAX_SETS = 50;

type Measures = Pick<WorkoutSet, "weight_kg" | "reps" | "duration_s" | "distance_m">;
const MEASURES = ["weight_kg", "reps", "duration_s", "distance_m"] as const;

/** Exercises for a session started from a workout template: same sets and types, nothing done yet. */
export function sessionFromRoutine(routine: Routine): WorkoutExercise[] {
  return routine.exercises.map((exercise) => ({
    exercise_id: exercise.exercise_id,
    ...(exercise.superset_group === undefined ? {} : { superset_group: exercise.superset_group }),
    sets: exercise.sets.map((set) => ({ set_type: set.set_type, completed: false })),
  }));
}

export function addExercises(
  exercises: readonly WorkoutExercise[],
  refs: readonly ExerciseRef[],
): WorkoutExercise[] {
  const room = Math.max(0, MAX_EXERCISES - exercises.length);
  return [
    ...exercises,
    ...refs.slice(0, room).map((exercise_id) => ({
      exercise_id,
      sets: Array.from({ length: 3 }, () => ({ set_type: "normal" as SetType, completed: false })),
    })),
  ];
}

export function removeExercise(exercises: readonly WorkoutExercise[], index: number) {
  return exercises.filter((_, i) => i !== index);
}

/** Moves one exercise to a new position (drag and drop); the others keep their order. */
export function moveExercise(
  exercises: readonly WorkoutExercise[],
  from: number,
  to: number,
): WorkoutExercise[] {
  const next = [...exercises];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Adds a set of the same type as the last one, not done and with no values yet. */
export function addSet(exercises: readonly WorkoutExercise[], index: number): WorkoutExercise[] {
  return mapExercise(exercises, index, (exercise) => {
    if (exercise.sets.length >= MAX_SETS) return exercise;
    const type = exercise.sets.at(-1)?.set_type ?? "normal";
    return { ...exercise, sets: [...exercise.sets, { set_type: type, completed: false }] };
  });
}

export function removeSet(
  exercises: readonly WorkoutExercise[],
  index: number,
  setIndex: number,
): WorkoutExercise[] {
  return mapExercise(exercises, index, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((_, i) => i !== setIndex),
  }));
}

/** Changes a set. undefined removes a value (contract: optional fields are absent). */
export function updateSet(
  exercises: readonly WorkoutExercise[],
  index: number,
  setIndex: number,
  changes: Partial<WorkoutSet>,
): WorkoutExercise[] {
  return mapExercise(exercises, index, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, i) => (i === setIndex ? applyChanges(set, changes) : set)),
  }));
}

/**
 * Ticks a set done (or un-ticks it). Ticking fills any empty measurement from the hint shown in
 * the field (last time's value, or the template's target), so repeating last session is one tap.
 */
export function toggleComplete(
  exercises: readonly WorkoutExercise[],
  index: number,
  setIndex: number,
  hint: Measures = {},
  tracking: Tracking = "weight_reps",
): WorkoutExercise[] {
  return mapExercise(exercises, index, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, i) => {
      if (i !== setIndex) return set;
      if (set.completed) return { ...set, completed: false };
      const filled: WorkoutSet = { ...set, completed: true };
      for (const key of fieldsFor(tracking)) {
        if (filled[key] === undefined && hint[key] !== undefined) filled[key] = hint[key];
      }
      return filled;
    }),
  }));
}

/** Which measurements a tracking type records. */
export function fieldsFor(tracking: Tracking): (typeof MEASURES)[number][] {
  switch (tracking) {
    case "weight_reps":
    case "weighted_bodyweight":
    case "assisted_bodyweight":
      return ["weight_kg", "reps"];
    case "reps_only":
      return ["reps"];
    case "duration":
      return ["duration_s"];
    case "distance_duration":
      return ["distance_m", "duration_s"];
    case "weight_distance":
      return ["weight_kg", "distance_m"];
  }
}

/**
 * The greyed-out value shown in each empty field: the same set from last time this exercise was
 * done, otherwise the template's target.
 */
export function setHints(
  sets: readonly WorkoutSet[],
  previous: readonly LoggedSet[],
  template?: RoutineExercise,
): Measures[] {
  return sets.map((_, i) => {
    const last = previous[i];
    if (last) {
      return Object.fromEntries(
        MEASURES.filter((k) => last[k] !== undefined).map((k) => [k, last[k]]),
      ) as Measures;
    }
    const target = template?.sets[i];
    if (!target) return {};
    const hint: Measures = {};
    if (target.target_weight_kg !== undefined) hint.weight_kg = target.target_weight_kg;
    const reps = target.target_reps_max ?? target.target_reps_min;
    if (reps !== undefined) hint.reps = reps;
    if (target.target_duration_s !== undefined) hint.duration_s = target.target_duration_s;
    if (target.target_distance_m !== undefined) hint.distance_m = target.target_distance_m;
    return hint;
  });
}

/** The template exercise matching session exercise `index`: same position if it matches, else the first with that ref. */
export function templateFor(
  routine: Routine | null | undefined,
  exercise: WorkoutExercise,
  index: number,
): RoutineExercise | undefined {
  if (!routine) return undefined;
  const same = routine.exercises[index];
  if (same?.exercise_id === exercise.exercise_id) return same;
  return routine.exercises.find((e) => e.exercise_id === exercise.exercise_id);
}

/**
 * What gets saved at Finish: sets never ticked and never filled in are dropped, then exercises
 * left with no sets. Partly filled unticked sets are kept as not done.
 */
export function cleanForFinish(exercises: readonly WorkoutExercise[]): WorkoutExercise[] {
  return exercises
    .map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter(
        (set) => set.completed || MEASURES.some((k) => set[k] !== undefined),
      ),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

export type SessionSummary = {
  exercises: number;
  completedSets: number;
  unfinishedSets: number;
  /** Sum of weight × reps over completed working sets, in kg. */
  volumeKg: number;
};

export function summarise(exercises: readonly WorkoutExercise[]): SessionSummary {
  let completedSets = 0;
  let unfinishedSets = 0;
  let volumeKg = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.completed) {
        unfinishedSets++;
        continue;
      }
      completedSets++;
      if (set.set_type !== "warmup" && set.weight_kg !== undefined && set.reps !== undefined) {
        volumeKg += set.weight_kg * set.reps;
      }
    }
  }
  return { exercises: exercises.length, completedSets, unfinishedSets, volumeKg };
}

/** "Morning workout" etc. for an empty session. */
export function defaultSessionName(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Night workout";
  if (hour < 12) return "Morning workout";
  if (hour < 17) return "Afternoon workout";
  if (hour < 21) return "Evening workout";
  return "Night workout";
}

function mapExercise(
  exercises: readonly WorkoutExercise[],
  index: number,
  fn: (exercise: WorkoutExercise) => WorkoutExercise,
): WorkoutExercise[] {
  return exercises.map((exercise, i) => (i === index ? fn(exercise) : exercise));
}

function applyChanges(set: WorkoutSet, changes: Partial<WorkoutSet>): WorkoutSet {
  const next = { ...set } as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as WorkoutSet;
}
