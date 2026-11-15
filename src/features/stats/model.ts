// Pure functions behind the Profile stats, PR badges and the e1RM chart. Dates are bucketed in the
// phone's local time, with weeks starting on Monday.
import type { ExerciseRef, MuscleGroup, Tracking } from "@/data/contract";
import type { WorkoutSummary } from "@/data/stats";
import type { LoggedSet } from "@/data/workouts";
import { estimatedOneRepMax } from "@/lib/units";

export type Range = "1M" | "3M" | "6M" | "1Y" | "All";
export const RANGES: readonly Range[] = ["1M", "3M", "6M", "1Y", "All"];
export type BucketSize = "week" | "month";

const MONTHS: Record<Exclude<Range, "All">, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };

/** Weekly bars up to six months, monthly beyond. */
export function bucketSizeFor(range: Range): BucketSize {
  return range === "1Y" || range === "All" ? "month" : "week";
}

/** Midnight at the start of the week (Monday) or month containing `date`, local time. */
export function bucketStart(date: Date, size: BucketSize): Date {
  if (size === "month") return new Date(date.getFullYear(), date.getMonth(), 1);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function nextBucket(start: Date, size: BucketSize): Date {
  return size === "month"
    ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

/**
 * The first bucket a range covers. "All" starts at the first workout (or now with none). The rest go
 * back that many months from now, rounded down to the start of that week or month.
 */
export function rangeStart(range: Range, now: Date, firstWorkout?: string): Date {
  const size = bucketSizeFor(range);
  if (range === "All") return bucketStart(firstWorkout ? new Date(firstWorkout) : now, size);
  const back = new Date(now.getFullYear(), now.getMonth() - MONTHS[range], now.getDate());
  return bucketStart(back, size);
}

/** Start of every bucket from `from` up to and including the one holding `now`. */
export function bucketStarts(from: Date, now: Date, size: BucketSize): Date[] {
  const last = bucketStart(now, size).getTime();
  const starts: Date[] = [];
  for (let d = bucketStart(from, size); d.getTime() <= last; d = nextBucket(d, size)) {
    starts.push(d);
  }
  return starts;
}

/** Index of the bucket an ISO timestamp falls into, or -1 if it's outside them all. */
function bucketIndex(starts: readonly Date[], iso: string, size: BucketSize): number {
  const key = bucketStart(new Date(iso), size).getTime();
  return starts.findIndex((s) => s.getTime() === key);
}

/** A ticked-off set that isn't a warm-up (the same rule as exercise records). */
export function isWorking(set: Pick<LoggedSet, "completed" | "set_type">): boolean {
  return set.completed && set.set_type !== "warmup";
}

const LOADED: readonly Tracking[] = ["weight_reps", "weighted_bodyweight"];

/**
 * Volume of one set: weight × reps, only for exercises where the weight is the load lifted
 * (assisted exercises store the assistance, and bodyweight isn't recorded).
 */
export function setVolume(set: LoggedSet, tracking: Tracking): number {
  if (!isWorking(set) || !LOADED.includes(tracking)) return 0;
  return (set.weight_kg ?? 0) * (set.reps ?? 0);
}

export type TrackingOf = (ref: ExerciseRef) => Tracking;

export function workoutsPerBucket(
  workouts: readonly WorkoutSummary[],
  starts: readonly Date[],
  size: BucketSize,
): number[] {
  const counts = starts.map(() => 0);
  for (const w of workouts) {
    const i = bucketIndex(starts, w.started_at, size);
    if (i >= 0) counts[i]!++;
  }
  return counts;
}

export function volumePerBucket(
  sets: readonly LoggedSet[],
  starts: readonly Date[],
  size: BucketSize,
  trackingOf: TrackingOf,
): number[] {
  const totals = starts.map(() => 0);
  for (const set of sets) {
    const volume = setVolume(set, trackingOf(set.exercise_id));
    if (volume === 0) continue;
    const i = bucketIndex(starts, set.performed_at, size);
    if (i >= 0) totals[i]! += volume;
  }
  return totals;
}

export type Totals = { workouts: number; volumeKg: number; seconds: number };

export function totals(
  workouts: readonly WorkoutSummary[],
  sets: readonly LoggedSet[],
  trackingOf: TrackingOf,
): Totals {
  let seconds = 0;
  for (const w of workouts) {
    seconds += Math.max(0, (Date.parse(w.ended_at) - Date.parse(w.started_at)) / 1000);
  }
  let volumeKg = 0;
  for (const set of sets) volumeKg += setVolume(set, trackingOf(set.exercise_id));
  return { workouts: workouts.length, volumeKg, seconds };
}

/**
 * Weeks in a row (Monday to Sunday) with at least one workout, counting back from this week. This
 * week only adds to the streak; it can't break it until it's over.
 */
export function weekStreak(workouts: readonly Pick<WorkoutSummary, "started_at">[], now: Date) {
  const weeks = new Set(workouts.map((w) => bucketStart(new Date(w.started_at), "week").getTime()));
  let week = bucketStart(now, "week");
  if (!weeks.has(week.getTime())) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week.getTime())) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

const addDays = (d: Date, days: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

export type MuscleGroupKey = "back" | "legs" | "chest" | "shoulders" | "arms" | "core";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupKey, string> = {
  back: "Back",
  legs: "Legs",
  chest: "Chest",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
};

const GROUP_OF: Partial<Record<MuscleGroup, MuscleGroupKey>> = {
  upper_back: "back",
  lats: "back",
  traps: "back",
  lower_back: "back",
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  adductors: "legs",
  abductors: "legs",
  calves: "legs",
  chest: "chest",
  shoulders: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  abs: "core",
  obliques: "core",
};

/** Working sets per muscle group (by each exercise's primary muscle), biggest first. */
export function muscleBalance(
  sets: readonly LoggedSet[],
  muscleOf: (ref: ExerciseRef) => MuscleGroup | undefined,
): { group: MuscleGroupKey; sets: number }[] {
  const counts = new Map<MuscleGroupKey, number>();
  for (const set of sets) {
    if (!isWorking(set)) continue;
    const muscle = muscleOf(set.exercise_id);
    const group = muscle ? GROUP_OF[muscle] : undefined;
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroupKey[])
    .map((group) => ({ group, sets: counts.get(group) ?? 0 }))
    .sort((a, b) => b.sets - a.sets);
}

export type E1rmPoint = { workout_id: string; performed_at: string; kg: number };

/** Best estimated 1RM per session for one exercise, oldest first. */
export function e1rmSeries(sets: readonly LoggedSet[], ref: ExerciseRef): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const set of sets) {
    if (set.exercise_id !== ref || !isWorking(set)) continue;
    if (set.weight_kg === undefined || set.reps === undefined) continue;
    const kg = estimatedOneRepMax(set.weight_kg, set.reps);
    if (kg === undefined) continue;
    const last = points.at(-1);
    if (last?.workout_id === set.workout_id) last.kg = Math.max(last.kg, kg);
    else points.push({ workout_id: set.workout_id, performed_at: set.performed_at, kg });
  }
  return points;
}

/** The weight-based exercise with the most working sets, for the e1RM chart's default. */
export function mostLoggedWeighted(
  sets: readonly LoggedSet[],
  trackingOf: TrackingOf,
): ExerciseRef | undefined {
  const counts = new Map<ExerciseRef, number>();
  for (const set of sets) {
    if (!isWorking(set) || set.weight_kg === undefined || set.reps === undefined) continue;
    if (!LOADED.includes(trackingOf(set.exercise_id))) continue;
    counts.set(set.exercise_id, (counts.get(set.exercise_id) ?? 0) + 1);
  }
  let best: ExerciseRef | undefined;
  for (const [ref, n] of counts) if (best === undefined || n > counts.get(best)!) best = ref;
  return best;
}

export type PrKind = "e1rm" | "weight" | "reps";
export type Pr = {
  kind: PrKind;
  exercise_id: ExerciseRef;
  workout_id: string;
  performed_at: string;
  value: number;
  set: LoggedSet;
};

/**
 * Personal records, oldest first: each time a session beats every earlier session's best. The
 * first session with an exercise sets the baseline and isn't a PR. Weight-based exercises get
 * best estimated 1RM and heaviest weight; reps-only exercises get most reps. `sets` must be in
 * time order, each workout's sets together (as the stats repo returns them).
 */
export function findPrs(sets: readonly LoggedSet[], trackingOf: TrackingOf): Pr[] {
  // One session = one exercise in one workout (even if it appears twice in that workout).
  const sessions = new Map<string, LoggedSet[]>();
  for (const set of sets) {
    const key = `${set.workout_id}|${set.exercise_id}`;
    const list = sessions.get(key);
    if (list) list.push(set);
    else sessions.set(key, [set]);
  }

  const best = new Map<ExerciseRef, Partial<Record<PrKind, number>>>();
  const prs: Pr[] = [];
  for (const session of sessions.values()) {
    const first = session[0]!;
    const top = sessionTops(session, trackingOf(first.exercise_id));
    const previous = best.get(first.exercise_id);
    const next = { ...previous };
    for (const kind of Object.keys(top) as PrKind[]) {
      const { value, set } = top[kind]!;
      const before = previous?.[kind];
      if (previous !== undefined && value > (before ?? 0) + 1e-9) {
        prs.push({
          kind,
          exercise_id: first.exercise_id,
          workout_id: first.workout_id,
          performed_at: first.performed_at,
          value,
          set,
        });
      }
      if (before === undefined || value > before) next[kind] = value;
    }
    best.set(first.exercise_id, next);
  }
  return prs;
}

function sessionTops(session: readonly LoggedSet[], tracking: Tracking) {
  const top: Partial<Record<PrKind, { value: number; set: LoggedSet }>> = {};
  const consider = (kind: PrKind, value: number | undefined, set: LoggedSet) => {
    if (value === undefined || value <= 0) return;
    if (value > (top[kind]?.value ?? 0)) top[kind] = { value, set };
  };
  for (const set of session) {
    if (!isWorking(set)) continue;
    if (LOADED.includes(tracking) && set.weight_kg !== undefined) {
      consider("weight", set.weight_kg, set);
      if (set.reps !== undefined)
        consider("e1rm", estimatedOneRepMax(set.weight_kg, set.reps), set);
    } else if (tracking === "reps_only") {
      consider("reps", set.reps, set);
    }
  }
  return top;
}

/** Number of PRs per workout id. */
export function prCountByWorkout(prs: readonly Pr[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pr of prs) counts.set(pr.workout_id, (counts.get(pr.workout_id) ?? 0) + 1);
  return counts;
}

/**
 * For each program's workouts, the one to do next: the first never done (in the program's order),
 * else the one done longest ago. Only for programs with two or more workouts, one of them done.
 */
export function nextUpByFolder(
  folders: readonly { routines: readonly { id: string }[] }[],
  lastDone: ReadonlyMap<string, string>,
): Set<string> {
  const next = new Set<string>();
  for (const { routines } of folders) {
    if (routines.length < 2 || !routines.some((r) => lastDone.has(r.id))) continue;
    const never = routines.find((r) => !lastDone.has(r.id));
    if (never) {
      next.add(never.id);
      continue;
    }
    let pick = routines[0]!;
    for (const r of routines) if (lastDone.get(r.id)! < lastDone.get(pick.id)!) pick = r;
    next.add(pick.id);
  }
  return next;
}
