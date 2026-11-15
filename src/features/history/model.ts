import type { RoutineExercise, RoutineSet, Workout } from "@/data/contract";
import type { RoutineInput } from "@/data/routines";
import { summarise } from "@/features/workout/session";

export type SessionStats = {
  durationSeconds?: number;
  completedSets: number;
  volumeKg: number;
};

export function sessionStats(workout: Workout): SessionStats {
  const { completedSets, volumeKg } = summarise(workout.exercises);
  const durationSeconds =
    workout.ended_at === undefined
      ? undefined
      : Math.max(0, (Date.parse(workout.ended_at) - Date.parse(workout.started_at)) / 1000);
  return { durationSeconds, completedSets, volumeKg };
}

export type MonthSection = { key: string; title: string; data: Workout[] };

/** Sessions (newest first) grouped under "November 2026"-style headings, in the device's locale. */
export function groupByMonth(workouts: readonly Workout[], locale?: string): MonthSection[] {
  const format = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const sections: MonthSection[] = [];
  for (const workout of workouts) {
    const date = new Date(workout.started_at);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    let section = sections.at(-1);
    if (section?.key !== key) {
      section = { key, title: format.format(date), data: [] };
      sections.push(section);
    }
    section.data.push(workout);
  }
  return sections;
}

/**
 * A workout template from a logged session: same exercises and set types, with what was lifted as
 * the targets. Unticked sets are left out.
 */
export function templateFromSession(workout: Workout): RoutineInput {
  const exercises: RoutineExercise[] = workout.exercises
    .map((exercise) => ({
      exercise_id: exercise.exercise_id,
      ...(exercise.superset_group === undefined ? {} : { superset_group: exercise.superset_group }),
      sets: exercise.sets
        .filter((set) => set.completed)
        .slice(0, 30)
        .map((set): RoutineSet => {
          const target: RoutineSet = { set_type: set.set_type };
          if (set.reps !== undefined) {
            target.target_reps_min = set.reps;
            target.target_reps_max = set.reps;
          }
          if (set.weight_kg !== undefined) target.target_weight_kg = set.weight_kg;
          if (set.duration_s !== undefined) target.target_duration_s = set.duration_s;
          if (set.distance_m !== undefined) target.target_distance_m = set.distance_m;
          return target;
        }),
    }))
    .filter((exercise) => exercise.sets.length > 0);
  return { name: workout.name, exercises };
}
