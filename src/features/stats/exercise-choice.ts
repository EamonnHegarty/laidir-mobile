import type { ExerciseRef } from "@/data/contract";

// Like the exercise picker: the Profile screen stays mounted under the choice screen, so a
// callback hands the choice back. Only one is open at a time.
let pending: { options: ExerciseRef[]; onPick: (ref: ExerciseRef) => void } | null = null;

/** Opens the single-choice screen with these exercises (most logged first). */
export function openExerciseChoice(
  open: () => void,
  options: ExerciseRef[],
  onPick: (ref: ExerciseRef) => void,
) {
  pending = { options, onPick };
  open();
}

export function pendingExerciseChoice() {
  return pending;
}

export function resolveExerciseChoice(ref: ExerciseRef) {
  pending?.onPick(ref);
  pending = null;
}
