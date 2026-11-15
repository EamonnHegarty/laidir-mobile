// App-facing names for the laidir-api v1 contract types (generated from the pinned OpenAPI spec).
import type { components } from "@/generated/openapi";

type Schemas = components["schemas"];

export type Profile = Schemas["Profile"];
export type Exercise = Schemas["Exercise"];
export type RoutineFolder = Schemas["RoutineFolder"];
export type Routine = Schemas["Routine"];
export type Workout = Schemas["Workout"];

export type RoutineExercise = Schemas["RoutineExercise"];
export type RoutineSet = Schemas["RoutineSet"];
export type WorkoutExercise = Schemas["WorkoutExercise"];
export type WorkoutSet = Schemas["WorkoutSet"];

export type ExerciseRef = Schemas["ExerciseRef"];
export type Equipment = Schemas["Equipment"];
export type MuscleGroup = Schemas["MuscleGroup"];
export type Tracking = Schemas["Tracking"];
export type SetType = Schemas["SetType"];
export type Timestamp = Schemas["Timestamp"];

/** Items stored locally and (from phase 3) synced. Profile isn't stored until login; see settings.ts. */
export type Entity = Exercise | RoutineFolder | Routine | Workout;
export type EntityType = Entity["type"];

export const SCHEMA_VERSION = 1;
