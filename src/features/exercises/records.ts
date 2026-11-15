import type { Tracking } from "@/data/contract";
import type { ExerciseSession, LoggedSet } from "@/data/workouts";
import { estimatedOneRepMax } from "@/lib/units";

export type ExerciseRecords = {
  /** Heaviest completed working set (weight-based tracking). */
  heaviest?: LoggedSet;
  /** Best estimated one-rep max and the set it came from (weight × reps tracking). */
  bestOneRepMax?: { kg: number; set: LoggedSet };
  /** Most reps in one completed working set. */
  mostReps?: LoggedSet;
  /** Number of workouts the exercise appears in (within the sessions given). */
  sessions: number;
};

const WEIGHT_REPS: readonly Tracking[] = ["weight_reps", "weighted_bodyweight"];

/** Personal records from history. Warm-ups and sets not ticked off don't count. */
export function exerciseRecords(
  sessions: readonly ExerciseSession[],
  tracking: Tracking,
): ExerciseRecords {
  const records: ExerciseRecords = { sessions: sessions.length };
  const working = sessions
    .flatMap((s) => s.sets)
    .filter((s) => s.completed && s.set_type !== "warmup");

  for (const set of working) {
    if (set.reps !== undefined && set.reps > (records.mostReps?.reps ?? 0)) records.mostReps = set;

    if (!WEIGHT_REPS.includes(tracking) || set.weight_kg === undefined) continue;
    if (set.weight_kg > (records.heaviest?.weight_kg ?? -1)) records.heaviest = set;
    if (set.reps !== undefined) {
      const e1rm = estimatedOneRepMax(set.weight_kg, set.reps);
      if (e1rm !== undefined && e1rm > (records.bestOneRepMax?.kg ?? 0)) {
        records.bestOneRepMax = { kg: e1rm, set };
      }
    }
  }
  return records;
}
