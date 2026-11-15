import type { Equipment, MuscleGroup, SetType, Tracking } from "@/data/contract";

// `satisfies Record<…>` makes the compiler flag any enum value the contract adds or removes.

export const EQUIPMENT_LABELS = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  kettlebell: "Kettlebell",
  machine: "Machine",
  cable: "Cable",
  smith_machine: "Smith machine",
  bodyweight: "Bodyweight",
  band: "Band",
  other: "Other",
} as const satisfies Record<Equipment, string>;

export const MUSCLE_LABELS = {
  chest: "Chest",
  upper_back: "Upper back",
  lats: "Lats",
  traps: "Traps",
  lower_back: "Lower back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  glutes: "Glutes",
  quads: "Quads",
  hamstrings: "Hamstrings",
  adductors: "Adductors",
  abductors: "Abductors",
  calves: "Calves",
  neck: "Neck",
  full_body: "Full body",
  cardio: "Cardio",
  other: "Other",
} as const satisfies Record<MuscleGroup, string>;

export const TRACKING_LABELS = {
  weight_reps: "Weight × reps",
  reps_only: "Reps only",
  weighted_bodyweight: "Bodyweight + added weight",
  assisted_bodyweight: "Assisted bodyweight",
  duration: "Time",
  distance_duration: "Distance + time",
  weight_distance: "Weight + distance",
} as const satisfies Record<Tracking, string>;

export const SET_TYPE_LABELS = {
  normal: "Working",
  warmup: "Warm-up",
  drop: "Drop set",
  failure: "Failure",
} as const satisfies Record<SetType, string>;

const keysOf = <K extends string>(labels: Record<K, string>) => Object.keys(labels) as K[];

export const EQUIPMENT: readonly Equipment[] = keysOf(EQUIPMENT_LABELS);
export const MUSCLES: readonly MuscleGroup[] = keysOf(MUSCLE_LABELS);
export const TRACKING: readonly Tracking[] = keysOf(TRACKING_LABELS);
