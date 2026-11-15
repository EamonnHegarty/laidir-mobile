import { kgToUnit, type WeightUnit } from "@/lib/units";

import type { BucketSize } from "./model";

/** Big totals, short: "850 kg", "12.4t", "18.2k lb". */
export function formatTotalWeight(kg: number, unit: WeightUnit): string {
  if (unit === "kg") {
    if (kg < 1000) return `${Math.round(kg)} kg`;
    return `${trim(kg / 1000)}t`;
  }
  const lb = kgToUnit(kg, unit);
  if (lb < 1000) return `${Math.round(lb)} lb`;
  return `${trim(lb / 1000)}k lb`;
}

/** Time trained: "45 min", "6.5 h", "38 h". */
export function formatHours(seconds: number): string {
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 10 ? `${trim(hours)} h` : `${Math.round(hours)} h`;
}

const trim = (n: number) => (n < 100 ? String(Math.round(n * 10) / 10) : String(Math.round(n)));

/** Axis label for a bucket: "16 Nov" for weeks, "Nov" (or "Nov 25" across years) for months. */
export function bucketLabel(start: Date, size: BucketSize, withYear = false, locale?: string) {
  if (size === "week") {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(start);
  }
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    ...(withYear ? { year: "2-digit" } : {}),
  }).format(start);
}

/** "+12%" / "−5%" change, or undefined when there's nothing to compare with. */
export function percentChange(current: number, previous: number): string | undefined {
  if (previous <= 0) return undefined;
  const change = Math.round(((current - previous) / previous) * 100);
  return change >= 0 ? `+${change}%` : `−${Math.abs(change)}%`;
}
