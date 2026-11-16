import { type Clock, nextUpdatedAt } from "./clock";
import type { Timestamp } from "./contract";
import type { Db } from "./db";

/**
 * Sync metadata for the Profile, whose fields live in `settings` (see sync.ts). Created at the first
 * sign-in; until then there's no Profile and nothing to mark.
 */
export type ProfileMeta = { created_at: Timestamp; updated_at: Timestamp; dirty: boolean };

export const PROFILE_META_KEY = "local_profile";

export async function readKey<T>(db: Db, key: string): Promise<T | undefined> {
  const row = await db.first<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export async function writeKey(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, JSON.stringify(value)],
  );
}

export async function deleteKey(db: Db, key: string): Promise<void> {
  await db.run("DELETE FROM settings WHERE key = ?", [key]);
}

/**
 * Marks the Profile as changed. Call it in the same transaction as any write to a Profile field
 * (units, default rest, display name, per-exercise rest). Does nothing before the first sign-in.
 */
export async function touchProfile(db: Db, clock: Clock): Promise<void> {
  const meta = await readKey<ProfileMeta>(db, PROFILE_META_KEY);
  if (!meta) return;
  await writeKey(db, PROFILE_META_KEY, {
    ...meta,
    updated_at: nextUpdatedAt(clock, meta.updated_at),
    dirty: true,
  } satisfies ProfileMeta);
}
