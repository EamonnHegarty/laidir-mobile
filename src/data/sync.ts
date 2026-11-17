import type { Clock } from "./clock";
import { type Entity, type Profile, SCHEMA_VERSION } from "./contract";
import type { Db } from "./db";
import { PROFILE_META_KEY, type ProfileMeta, deleteKey, readKey, writeKey } from "./profile-meta";
import { DEFAULT_SETTINGS } from "./settings";
import { tables, writeEntity } from "./store";
import { rebuildSetLog } from "./workouts";

/**
 * Local side of sync (phase 3). Everything here works on the same SQLite database as the app:
 *
 * - **Entities** (exercises, folders, routines, workouts) carry a `dirty` flag, set on every local
 *   write. Push sends dirty rows; a row is marked clean only if it hasn't changed since it was sent.
 * - **Profile** isn't stored as a document: its fields live in `settings` (Profile field names) so
 *   the app works without an account. Its sync metadata (`local_profile`) is created when the user
 *   first signs in, and from then on every Profile-field change marks it dirty.
 * - Keys starting `local_` never leave the phone.
 * - The phone's data belongs to the first account that signs in (`local_account`).
 */
export type SyncItem = Entity | Profile;

export type Account = { sub: string; email?: string };

export class AccountMismatchError extends Error {
  constructor(readonly existing: Account) {
    super(
      `This phone's data belongs to ${existing.email ?? "another account"}. ` +
        "Erase it from this phone first to sign in as someone else.",
    );
    this.name = "AccountMismatchError";
  }
}

const ACCOUNT_KEY = "local_account";
const CURSOR_KEY = "local_sync_cursor";
/** Device preferences kept when the synced data is erased. */
const DEVICE_PREFS = [
  "local_accent",
  "local_appearance",
  "local_rest_alert",
  "local_workout_reminder",
  "local_exact_alarm_asked",
  "local_rest_ring_on_silent",
];
const ENTITY_TABLES = Object.values(tables).map((t) => t.table);

/** The Profile document for `sub`, built from settings. Undefined before the first sign-in. */
async function buildProfile(db: Db, sub: string): Promise<Profile | undefined> {
  const meta = await readKey<ProfileMeta>(db, PROFILE_META_KEY);
  if (!meta) return undefined;
  const weight = await readKey<Profile["weight_unit"]>(db, "weight_unit");
  const distance = await readKey<Profile["distance_unit"]>(db, "distance_unit");
  const rest = await readKey<number>(db, "default_rest_seconds");
  const name = await readKey<string>(db, "display_name");
  const restMap = await readKey<Record<string, number>>(db, "exercise_rest_seconds");
  const profile: Profile = {
    id: sub,
    type: "PROFILE",
    schema_version: SCHEMA_VERSION,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    deleted_at: null,
    weight_unit: weight ?? DEFAULT_SETTINGS.weight_unit,
    distance_unit: distance ?? DEFAULT_SETTINGS.distance_unit,
    default_rest_seconds: rest ?? DEFAULT_SETTINGS.default_rest_seconds,
  };
  if (name !== undefined) profile.display_name = name;
  if (restMap && Object.keys(restMap).length > 0) profile.exercise_rest_seconds = restMap;
  return profile;
}

/** Writes a Profile from the server into settings, without marking it dirty. */
async function adoptProfile(db: Db, profile: Profile): Promise<void> {
  await writeKey(db, "weight_unit", profile.weight_unit);
  await writeKey(db, "distance_unit", profile.distance_unit);
  if (profile.default_rest_seconds !== undefined) {
    await writeKey(db, "default_rest_seconds", profile.default_rest_seconds);
  } else await deleteKey(db, "default_rest_seconds");
  if (profile.display_name !== undefined) await writeKey(db, "display_name", profile.display_name);
  else await deleteKey(db, "display_name");
  await writeKey(db, "exercise_rest_seconds", profile.exercise_rest_seconds ?? {});
  await writeKey(db, PROFILE_META_KEY, {
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    dirty: false,
  } satisfies ProfileMeta);
}

type Row = { doc: string; dirty: number; updated_at: string };

export function syncRepo({ db, clock }: { db: Db; clock: Clock }) {
  return {
    async account(): Promise<Account | undefined> {
      return readKey<Account>(db, ACCOUNT_KEY);
    },

    /**
     * Ties this phone's data to the signed-in account. The first sign-in claims it; signing in again
     * as the same user is fine; another user is refused until the data is erased.
     *
     * `serverProfile` is the account's Profile if it already has one (another phone): it wins over
     * this phone's settings. Otherwise the settings become the Profile and are pushed.
     */
    async bindAccount(account: Account, serverProfile: Profile | undefined): Promise<void> {
      await db.transaction(async (tx) => {
        const existing = await readKey<Account>(tx, ACCOUNT_KEY);
        if (existing && existing.sub !== account.sub) throw new AccountMismatchError(existing);
        await writeKey(tx, ACCOUNT_KEY, account);
        if (await readKey<ProfileMeta>(tx, PROFILE_META_KEY)) return;
        if (serverProfile) {
          await adoptProfile(tx, serverProfile);
        } else {
          const now = clock.now();
          await writeKey(tx, PROFILE_META_KEY, {
            created_at: now,
            updated_at: now,
            dirty: true,
          } satisfies ProfileMeta);
        }
      });
    },

    /**
     * Erases everything that syncs (and the account link), keeping only device preferences. Used to
     * sign in as a different account on this phone.
     */
    async eraseSyncedData(): Promise<void> {
      await db.transaction(async (tx) => {
        for (const table of [...ENTITY_TABLES, "set_log"]) await tx.run(`DELETE FROM ${table}`);
        const keep = DEVICE_PREFS.map(() => "?").join(", ");
        await tx.run(`DELETE FROM settings WHERE key NOT IN (${keep})`, DEVICE_PREFS);
      });
    },

    async cursor(): Promise<string | undefined> {
      return readKey<string>(db, CURSOR_KEY);
    },

    /** Items changed on this phone since they were last pushed (Profile first). */
    async pending(sub: string, limit: number): Promise<SyncItem[]> {
      const items: SyncItem[] = [];
      const meta = await readKey<ProfileMeta>(db, PROFILE_META_KEY);
      if (meta?.dirty) {
        const profile = await buildProfile(db, sub);
        if (profile) items.push(profile);
      }
      // Folders before routines before workouts, so another phone rarely sees a dangling reference.
      for (const table of ["exercises", "routine_folders", "routines", "workouts"]) {
        if (items.length >= limit) break;
        const rows = await db.all<Row>(
          `SELECT doc, dirty, updated_at FROM ${table} WHERE dirty = 1 ORDER BY updated_at LIMIT ?`,
          [limit - items.length],
        );
        for (const row of rows) items.push(JSON.parse(row.doc) as SyncItem);
      }
      return items;
    },

    async pendingCount(): Promise<number> {
      let count = (await readKey<ProfileMeta>(db, PROFILE_META_KEY))?.dirty ? 1 : 0;
      for (const table of ENTITY_TABLES) {
        const row = await db.first<{ n: number }>(
          `SELECT COUNT(*) AS n FROM ${table} WHERE dirty = 1`,
        );
        count += row?.n ?? 0;
      }
      return count;
    },

    /** The server accepted `item`: clean it, unless it changed again while the push was in flight. */
    async markPushed(item: SyncItem): Promise<void> {
      if (item.type === "PROFILE") {
        await db.transaction(async (tx) => {
          const meta = await readKey<ProfileMeta>(tx, PROFILE_META_KEY);
          if (meta && meta.updated_at === item.updated_at) {
            await writeKey(tx, PROFILE_META_KEY, { ...meta, dirty: false } satisfies ProfileMeta);
          }
        });
        return;
      }
      await db.run(
        `UPDATE ${tables[item.type].table} SET dirty = 0 WHERE id = ? AND updated_at = ?`,
        [item.id, item.updated_at],
      );
    },

    /**
     * Applies a pulled item (or a `stale` result's server copy). Last writer wins on updated_at:
     * a local change that's newer (or equal) and not yet pushed is kept and pushed later.
     * Returns whether anything changed.
     */
    async applyRemote(item: SyncItem): Promise<boolean> {
      return db.transaction(async (tx) => {
        if (item.type === "PROFILE") {
          const meta = await readKey<ProfileMeta>(tx, PROFILE_META_KEY);
          if (meta) {
            if (meta.updated_at === item.updated_at) return false;
            if (meta.dirty && meta.updated_at > item.updated_at) return false;
          }
          await adoptProfile(tx, item);
          return true;
        }
        const table = tables[item.type].table;
        const local = await tx.first<Row>(
          `SELECT doc, dirty, updated_at FROM ${table} WHERE id = ?`,
          [item.id],
        );
        if (local) {
          if (local.updated_at === item.updated_at) return false;
          if (local.dirty === 1 && local.updated_at > item.updated_at) return false;
        }
        await writeEntity(tx, item, { dirty: false });
        if (item.type === "WORKOUT") await rebuildSetLog(tx, item);
        return true;
      });
    },

    async setCursor(cursor: string): Promise<void> {
      if ((await readKey<string>(db, CURSOR_KEY)) === cursor) return;
      await writeKey(db, CURSOR_KEY, cursor);
    },
  };
}

export type SyncRepo = ReturnType<typeof syncRepo>;
