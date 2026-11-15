import catalogueJson from "../../contract/catalogue/v1/exercises.json";
import type { Equipment, Exercise, ExerciseRef, MuscleGroup, Tracking } from "./contract";

/** One built-in exercise (contract/catalogue/v1/exercises.schema.json). */
export type CatalogueExercise = {
  slug: string;
  name: string;
  equipment: Equipment;
  primary_muscle: MuscleGroup;
  secondary_muscles?: MuscleGroup[];
  tracking: Tracking;
  /** Hidden from pickers; existing references still resolve. */
  deprecated?: boolean;
};

type Catalogue = { catalogue_version: number; exercises: CatalogueExercise[] };

// Validated against its JSON Schema in tests, so this cast is checked there.
const catalogue = catalogueJson as unknown as Catalogue;

export const CATALOGUE_VERSION = catalogue.catalogue_version;

const BUILTIN_PREFIX = "builtin:";
const bySlug = new Map(catalogue.exercises.map((e) => [e.slug, e]));

export const builtinRef = (slug: string): ExerciseRef => `${BUILTIN_PREFIX}${slug}`;
export const isBuiltinRef = (ref: ExerciseRef) => ref.startsWith(BUILTIN_PREFIX);

/** All built-ins, including deprecated ones. */
export const allBuiltins: readonly CatalogueExercise[] = catalogue.exercises;

/** Built-ins offered in pickers: not deprecated, sorted by name. */
export const pickerBuiltins: readonly CatalogueExercise[] = catalogue.exercises
  .filter((e) => !e.deprecated)
  .sort((a, b) => a.name.localeCompare(b.name));

export function findBuiltin(ref: ExerciseRef): CatalogueExercise | undefined {
  return isBuiltinRef(ref) ? bySlug.get(ref.slice(BUILTIN_PREFIX.length)) : undefined;
}

/** What screens need to show any exercise reference, built-in or custom. */
export type ExerciseInfo = {
  ref: ExerciseRef;
  name: string;
  equipment?: Equipment;
  primary_muscle?: MuscleGroup;
  tracking: Tracking;
  source: "builtin" | "custom" | "unknown";
  /** Deprecated built-in or deleted custom exercise: still shown in history, hidden from pickers. */
  retired: boolean;
};

/**
 * Resolves an exercise_id. `custom` is the user's exercise for a UUID ref, including tombstones (so a
 * deleted exercise keeps its name in history). Unknown refs, e.g. a custom exercise that hasn't
 * synced yet, get a placeholder rather than an error.
 */
export function describeExercise(ref: ExerciseRef, custom?: Exercise | null): ExerciseInfo {
  const builtin = findBuiltin(ref);
  if (builtin) {
    return {
      ref,
      name: builtin.name,
      equipment: builtin.equipment,
      primary_muscle: builtin.primary_muscle,
      tracking: builtin.tracking,
      source: "builtin",
      retired: builtin.deprecated === true,
    };
  }
  if (custom && custom.id === ref) {
    return {
      ref,
      name: custom.name,
      equipment: custom.equipment,
      primary_muscle: custom.primary_muscle,
      tracking: custom.tracking,
      source: "custom",
      retired: custom.deleted_at !== null,
    };
  }
  return {
    ref,
    name: "Unknown exercise",
    tracking: "weight_reps",
    source: "unknown",
    retired: true,
  };
}
