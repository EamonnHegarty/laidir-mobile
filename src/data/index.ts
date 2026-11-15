import type { Deps } from "./deps";
import { exercisesRepo } from "./exercises";
import { routinesRepo } from "./routines";
import { settingsRepo } from "./settings";
import { workoutsRepo } from "./workouts";

export function createRepositories(deps: Deps) {
  return {
    exercises: exercisesRepo(deps),
    routines: routinesRepo(deps),
    workouts: workoutsRepo(deps),
    settings: settingsRepo(deps),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./catalogue";
export * from "./contract";
export { NotFoundError, ValidationError } from "./store";
