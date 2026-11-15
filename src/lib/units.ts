import type { Settings } from "@/data/settings";

export type WeightUnit = Settings["weight_unit"];

/** Exact, by definition of the international pound. */
export const KG_PER_LB = 0.45359237;

/** Weight in the user's unit, unrounded. Storage is always kg at full precision. */
export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

/** A weight the user typed in their unit, converted to kg for storage (no rounding). */
export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

/** Rounds for display only: up to 2 decimals, trailing zeros dropped (102.5, 185, 61.25). */
export function displayNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${displayNumber(kgToUnit(kg, unit))} ${unit}`;
}

/** Estimated one-rep max (Epley). Undefined for zero reps; equal to the weight for a single. */
export function estimatedOneRepMax(weightKg: number, reps: number): number | undefined {
  if (reps <= 0) return undefined;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** "1:30", "45s", "1:02:05" style durations for sets and rest. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  if (minutes > 0) return `${minutes}:${pad(seconds)}`;
  return `${seconds}s`;
}

const pad = (n: number) => n.toString().padStart(2, "0");

export function formatDistance(metres: number, unit: Settings["distance_unit"]): string {
  if (unit === "km")
    return metres < 1000 ? `${displayNumber(metres)} m` : `${displayNumber(metres / 1000)} km`;
  return `${displayNumber(metres / 1609.344)} mi`;
}
