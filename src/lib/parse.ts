// Parsing what people type into number fields. Each returns undefined for an empty field and
// null for something that can't be understood, so forms can tell "cleared" from "invalid".

/** "102.5" or "102,5" → 102.5. Rejects negatives and non-numbers. */
export function parseDecimal(text: string): number | undefined | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return undefined;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Whole numbers only: "8" → 8. */
export function parseWhole(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export type RepRange = { min?: number; max?: number };

/** "8" → 8–8, "6-8" / "6–8" / "6 to 8" → 6–8 (swapped if reversed). "" → no target. */
export function parseRepRange(text: string): RepRange | null {
  const trimmed = text.trim();
  if (trimmed === "") return {};
  const parts = trimmed.split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length > 2) return null;
  const numbers = parts.map(parseWhole);
  if (numbers.some((n) => n === undefined || n === null)) return null;
  const [a, b = a] = numbers as number[];
  return { min: Math.min(a!, b!), max: Math.max(a!, b!) };
}

export function formatRepRange({ min, max }: RepRange): string {
  if (min === undefined && max === undefined) return "";
  if (min === undefined || max === undefined || min === max) return String(min ?? max);
  return `${min}–${max}`;
}

/** "90" → 90 s, "1:30" → 90 s, "1:02:05" → 3725 s. */
export function parseDuration(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const parts = trimmed.split(":");
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** 90 → "1:30", 45 → "0:45": the editable form of a duration (formatDuration is for reading). */
export function durationInput(seconds: number | undefined): string {
  if (seconds === undefined) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Phone-timer entry: digits fill from the right, so "200" is 2:00 and "1000" is 10:00. Two digits
 * are seconds, the next two minutes, anything before that hours. Leading zeros are dropped and
 * at most 6 digits are kept.
 */
export function timerDigits(text: string): string {
  return text.replace(/\D/g, "").replace(/^0+/, "").slice(0, 6);
}

/** "200" → "2:00", "5" → "0:05", "13000" → "1:30:00" (as typed, not normalised). */
export function formatTimerDigits(digits: string): string {
  const padded = digits.padStart(3, "0");
  const ss = padded.slice(-2);
  const rest = padded.slice(0, -2);
  if (rest.length <= 2) return `${Number(rest)}:${ss}`;
  return `${Number(rest.slice(0, -2))}:${rest.slice(-2)}:${ss}`;
}

/** Seconds for typed timer digits ("130" → 90, "90" → 90); undefined when empty. */
export function timerSeconds(digits: string): number | undefined {
  if (digits === "") return undefined;
  const padded = digits.padStart(6, "0");
  return (
    Number(padded.slice(0, 2)) * 3600 + Number(padded.slice(2, 4)) * 60 + Number(padded.slice(4))
  );
}
