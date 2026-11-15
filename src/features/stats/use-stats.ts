import { describeExercise } from "@/data/catalogue";
import type { Exercise, ExerciseRef, MuscleGroup, Tracking } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";

import { findPrs } from "./model";

/**
 * Everything the stats screens need, live: finished workouts and their sets (all time, oldest
 * first), the PRs found in them, settings, and lookups for each exercise's tracking and muscle.
 */
export function useStats() {
  return useLiveQuery(async (r) => {
    const [workouts, sets, custom, settings, displayName] = await Promise.all([
      r.stats.workouts(),
      r.stats.sets(),
      r.exercises.listAll(),
      r.settings.get(),
      r.settings.displayName(),
    ]);
    const customById = new Map<string, Exercise>(custom.map((e) => [e.id, e]));
    const info = new Map<ExerciseRef, ReturnType<typeof describeExercise>>();
    const describe = (ref: ExerciseRef) => {
      let found = info.get(ref);
      if (!found) {
        found = describeExercise(ref, customById.get(ref));
        info.set(ref, found);
      }
      return found;
    };
    const trackingOf = (ref: ExerciseRef): Tracking => describe(ref).tracking;
    const muscleOf = (ref: ExerciseRef): MuscleGroup | undefined => describe(ref).primary_muscle;
    const prs = findPrs(sets, trackingOf);
    return { workouts, sets, prs, settings, displayName, describe, trackingOf, muscleOf };
  }, []);
}

export type StatsData = NonNullable<ReturnType<typeof useStats>["data"]>;
