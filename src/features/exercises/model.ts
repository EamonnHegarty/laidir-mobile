import { builtinRef, pickerBuiltins } from "@/data/catalogue";
import type { Equipment, Exercise, ExerciseRef, MuscleGroup, Tracking } from "@/data/contract";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";

/** One row in the exercise list or picker: a built-in or one of the user's custom exercises. */
export type ExerciseListItem = {
  ref: ExerciseRef;
  name: string;
  equipment: Equipment;
  primary_muscle: MuscleGroup;
  secondary_muscles: readonly MuscleGroup[];
  tracking: Tracking;
  custom: boolean;
};

/** Built-ins (not deprecated) plus live custom exercises, sorted by name. */
export function exerciseListItems(custom: readonly Exercise[]): ExerciseListItem[] {
  const items: ExerciseListItem[] = [
    ...pickerBuiltins.map((e) => ({
      ref: builtinRef(e.slug),
      name: e.name,
      equipment: e.equipment,
      primary_muscle: e.primary_muscle,
      secondary_muscles: e.secondary_muscles ?? [],
      tracking: e.tracking,
      custom: false,
    })),
    ...custom
      .filter((e) => e.deleted_at === null)
      .map((e) => ({
        ref: e.id,
        name: e.name,
        equipment: e.equipment,
        primary_muscle: e.primary_muscle,
        secondary_muscles: e.secondary_muscles ?? [],
        tracking: e.tracking,
        custom: true,
      })),
  ];
  return items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export type ExerciseFilter = {
  search?: string;
  muscle?: MuscleGroup;
  equipment?: Equipment;
};

/** Lowercase, accents removed, punctuation as spaces: "Bench Press (Dumbbell)" → "bench press dumbbell". */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Every search word must appear somewhere in the name, equipment or muscles, in any order, so
 * "db bench" style queries work ("db" and "bb" are understood as dumbbell and barbell).
 * The muscle filter matches primary or secondary muscles.
 */
export function filterExercises(
  items: readonly ExerciseListItem[],
  { search = "", muscle, equipment }: ExerciseFilter,
): ExerciseListItem[] {
  const words = normalise(search)
    .split(" ")
    .filter(Boolean)
    .map((w) => ALIASES[w] ?? w);
  return items.filter((item) => {
    if (equipment && item.equipment !== equipment) return false;
    if (muscle && item.primary_muscle !== muscle && !item.secondary_muscles.includes(muscle)) {
      return false;
    }
    if (words.length === 0) return true;
    const haystack = normalise(
      [
        item.name,
        EQUIPMENT_LABELS[item.equipment],
        MUSCLE_LABELS[item.primary_muscle],
        ...item.secondary_muscles.map((m) => MUSCLE_LABELS[m]),
      ].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

const ALIASES: Record<string, string> = {
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
};
