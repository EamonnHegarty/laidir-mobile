import type { Tracking, WorkoutSet } from "@/data/contract";
import type { Settings } from "@/data/settings";

import { displayNumber, formatDistance, formatDuration, formatWeight } from "./units";

type Units = Pick<Settings, "weight_unit" | "distance_unit">;

/**
 * One set as a short line, e.g. "100 kg × 5", "+20 kg × 8", "12 reps", "2 km · 10:00", "@ RPE 8".
 * Shows only the fields the set has, interpreted by the exercise's tracking type.
 */
export function formatSet(
  set: Pick<WorkoutSet, "weight_kg" | "reps" | "duration_s" | "distance_m" | "rpe">,
  tracking: Tracking,
  units: Units,
): string {
  const parts: string[] = [];
  const weight = set.weight_kg;

  if (weight !== undefined) {
    const text = formatWeight(weight, units.weight_unit);
    if (tracking === "weighted_bodyweight") parts.push(`+${text}`);
    else if (tracking === "assisted_bodyweight") parts.push(`−${text}`);
    else parts.push(text);
  }

  if (set.reps !== undefined) {
    if (parts.length > 0) parts[parts.length - 1] += ` × ${set.reps}`;
    else parts.push(`${set.reps} ${set.reps === 1 ? "rep" : "reps"}`);
  }
  if (set.distance_m !== undefined) parts.push(formatDistance(set.distance_m, units.distance_unit));
  if (set.duration_s !== undefined) parts.push(formatDuration(set.duration_s));

  let line = parts.join(" · ") || "—";
  if (set.rpe !== undefined) line += ` @ RPE ${displayNumber(set.rpe)}`;
  return line;
}
