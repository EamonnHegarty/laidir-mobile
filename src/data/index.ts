import type { Deps } from "./deps";
import { backupRepo } from "./backup";
import { exercisesRepo } from "./exercises";
import { routinesRepo } from "./routines";
import { settingsRepo } from "./settings";
import { statsRepo } from "./stats";
import { syncRepo } from "./sync";
import { workoutsRepo } from "./workouts";

export function createRepositories(deps: Deps) {
  return {
    exercises: exercisesRepo(deps),
    routines: routinesRepo(deps),
    workouts: workoutsRepo(deps),
    settings: settingsRepo(deps),
    stats: statsRepo(deps),
    backup: backupRepo(deps),
    sync: syncRepo(deps),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./catalogue";
export * from "./contract";
export { NotFoundError, ValidationError } from "./store";
