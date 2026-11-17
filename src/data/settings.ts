import {
  type AccentName,
  type Appearance,
  DEFAULT_ACCENT,
  DEFAULT_APPEARANCE,
  isAccentName,
  isAppearance,
} from "@/constants/theme";

import type { Clock } from "./clock";
import type { Profile } from "./contract";
import type { Db } from "./db";
import { touchProfile } from "./profile-meta";

/**
 * Local preferences. They use Profile's field names and values so that at first login (phase 3)
 * they become the user's Profile item; Profile itself can't exist offline because its id is the
 * Cognito sub.
 */
export type Settings = {
  weight_unit: Profile["weight_unit"];
  distance_unit: Profile["distance_unit"];
  default_rest_seconds: NonNullable<Profile["default_rest_seconds"]>;
};

export const DEFAULT_SETTINGS: Settings = {
  weight_unit: "kg",
  distance_unit: "km",
  default_rest_seconds: 120,
};

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

/**
 * Writes to Profile fields (units, default rest, display name, per-exercise rest) also mark the
 * Profile changed for sync once an account exists (touchProfile). `local_` keys never do.
 */
export function settingsRepo({ db, clock }: { db: Db; clock: Clock }) {
  return {
    async get(): Promise<Settings> {
      const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings");
      const stored: Partial<Record<string, unknown>> = {};
      for (const row of rows) stored[row.key] = JSON.parse(row.value);
      return { ...DEFAULT_SETTINGS, ...pick(stored) };
    },

    async update(changes: Partial<Settings>): Promise<Settings> {
      await db.transaction(async (tx) => {
        let changed = false;
        for (const key of KEYS) {
          const value = changes[key];
          if (value === undefined) continue;
          await tx.run(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [key, JSON.stringify(value)],
          );
          changed = true;
        }
        if (changed) await touchProfile(tx, clock);
      });
      return this.get();
    },

    /**
     * Rest time chosen for each exercise during a workout (exercise ref → seconds). It wins over the
     * Workout template's rest and the default. Stored as Profile's `exercise_rest_seconds`, so it
     * becomes part of the Profile at first login.
     */
    async exerciseRest(): Promise<Map<string, number>> {
      return new Map(Object.entries(await readRestMap(db)));
    },

    /** The name shown on the Profile tab (Profile's `display_name`), if set. */
    async displayName(): Promise<string | undefined> {
      const [row] = await db.all<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
        NAME_KEY,
      ]);
      return row ? (JSON.parse(row.value) as string) : undefined;
    },

    /** Sets the display name (trimmed, 1–50 characters); empty or `null` clears it. */
    async setDisplayName(name: string | null): Promise<void> {
      const trimmed = name?.trim() ?? "";
      if ([...trimmed].length > MAX_NAME) {
        throw new RangeError(`A name can be at most ${MAX_NAME} characters`);
      }
      await db.transaction(async (tx) => {
        if (trimmed === "") {
          await tx.run("DELETE FROM settings WHERE key = ?", [NAME_KEY]);
        } else {
          await tx.run(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [NAME_KEY, JSON.stringify(trimmed)],
          );
        }
        await touchProfile(tx, clock);
      });
    },

    /**
     * The accent colour picked in Settings. Device-only: it isn't a Profile field, so it never
     * becomes part of the Profile item or syncs.
     */
    async accent(): Promise<AccentName> {
      const [row] = await db.all<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
        ACCENT_KEY,
      ]);
      const value: unknown = row ? JSON.parse(row.value) : undefined;
      return isAccentName(value) ? value : DEFAULT_ACCENT;
    },

    async setAccent(accent: AccentName): Promise<void> {
      if (!isAccentName(accent)) throw new RangeError(`Unknown accent ${String(accent)}`);
      await db.run(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        [ACCENT_KEY, JSON.stringify(accent)],
      );
    },

    /** Light, dark or follow the phone. Device-only. */
    async appearance(): Promise<Appearance> {
      const value = await readLocal(db, APPEARANCE_KEY);
      return isAppearance(value) ? value : DEFAULT_APPEARANCE;
    },

    async setAppearance(appearance: Appearance): Promise<void> {
      if (!isAppearance(appearance))
        throw new RangeError(`Unknown appearance ${String(appearance)}`);
      await writeLocal(db, APPEARANCE_KEY, appearance);
    },

    /** How the end of a rest is signalled (sound, vibration, both or nothing). Device-only. */
    async restAlert(): Promise<RestAlert> {
      const value = await readLocal(db, REST_ALERT_KEY);
      return isRestAlert(value) ? value : DEFAULT_REST_ALERT;
    },

    async setRestAlert(alert: RestAlert): Promise<void> {
      if (!isRestAlert(alert)) throw new RangeError(`Unknown rest alert ${String(alert)}`);
      await writeLocal(db, REST_ALERT_KEY, alert);
    },

    /** Whether to remind you about a workout left running with the app closed. Device-only. */
    async workoutReminder(): Promise<boolean> {
      const value = await readLocal(db, REMINDER_KEY);
      return typeof value === "boolean" ? value : true;
    },

    async setWorkoutReminder(on: boolean): Promise<void> {
      await writeLocal(db, REMINDER_KEY, on);
    },

    /** Whether "Rest over" rings even with the phone on silent (like a timer). Device-only; on by default. */
    async restRingOnSilent(): Promise<boolean> {
      const value = await readLocal(db, RING_ON_SILENT_KEY);
      return typeof value === "boolean" ? value : true;
    },

    async setRestRingOnSilent(on: boolean): Promise<void> {
      await writeLocal(db, RING_ON_SILENT_KEY, on);
    },

    /** Which sound the app plays when a rest is over. Device-only. */
    async restSound(): Promise<RestSound> {
      const value = await readLocal(db, REST_SOUND_KEY);
      return isRestSound(value) ? value : DEFAULT_REST_SOUND;
    },

    async setRestSound(sound: RestSound): Promise<void> {
      if (!isRestSound(sound)) throw new RangeError(`Unknown rest sound ${String(sound)}`);
      await writeLocal(db, REST_SOUND_KEY, sound);
    },

    /** Whether the one-time "allow exact rest alerts" prompt has been shown. Device-only. */
    async exactAlarmAsked(): Promise<boolean> {
      return (await readLocal(db, EXACT_ALARM_ASKED_KEY)) === true;
    },

    async setExactAlarmAsked(): Promise<void> {
      await writeLocal(db, EXACT_ALARM_ASKED_KEY, true);
    },

    /** Remembers the rest for one exercise; `null` goes back to the template/default. */
    async setExerciseRest(ref: string, seconds: number | null): Promise<void> {
      if (seconds !== null && (!Number.isInteger(seconds) || seconds < 0 || seconds > MAX_REST)) {
        throw new RangeError(`Rest must be 0 to ${MAX_REST} seconds`);
      }
      await db.transaction(async (tx) => {
        const map = await readRestMap(tx);
        if (seconds === null) delete map[ref];
        else {
          if (!(ref in map) && Object.keys(map).length >= MAX_EXERCISE_RESTS) {
            throw new RangeError(`At most ${MAX_EXERCISE_RESTS} exercises can have their own rest`);
          }
          map[ref] = seconds;
        }
        await tx.run(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
          [REST_KEY, JSON.stringify(map)],
        );
        await touchProfile(tx, clock);
      });
    },
  };
}

/** Profile field name, and its limits from the contract (RestSeconds, maxProperties). */
const REST_KEY = "exercise_rest_seconds";
const MAX_REST = 3600;
const MAX_EXERCISE_RESTS = 500;
const NAME_KEY = "display_name";
/** Not a Profile field: the "local_" prefix marks device-only keys, left out of the Profile at login. */
const ACCENT_KEY = "local_accent";
const MAX_NAME = 50;
const APPEARANCE_KEY = "local_appearance";
const REST_ALERT_KEY = "local_rest_alert";
const REMINDER_KEY = "local_workout_reminder";
const EXACT_ALARM_ASKED_KEY = "local_exact_alarm_asked";
const RING_ON_SILENT_KEY = "local_rest_ring_on_silent";
const REST_SOUND_KEY = "local_rest_sound";

export const REST_SOUNDS = ["beeps", "bell", "chime", "buzzer"] as const;
export type RestSound = (typeof REST_SOUNDS)[number];
export const DEFAULT_REST_SOUND: RestSound = "beeps";
export function isRestSound(value: unknown): value is RestSound {
  return typeof value === "string" && (REST_SOUNDS as readonly string[]).includes(value);
}

export const REST_ALERTS = ["both", "sound", "vibrate", "silent"] as const;
export type RestAlert = (typeof REST_ALERTS)[number];
export const DEFAULT_REST_ALERT: RestAlert = "both";
export function isRestAlert(value: unknown): value is RestAlert {
  return typeof value === "string" && (REST_ALERTS as readonly string[]).includes(value);
}

async function readLocal(db: Db, key: string): Promise<unknown> {
  const [row] = await db.all<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row ? JSON.parse(row.value) : undefined;
}

async function writeLocal(db: Db, key: string, value: unknown): Promise<void> {
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, JSON.stringify(value)],
  );
}

type RestMap = NonNullable<Profile["exercise_rest_seconds"]>;

async function readRestMap(db: Db): Promise<RestMap> {
  const [row] = await db.all<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    REST_KEY,
  ]);
  return row ? (JSON.parse(row.value) as RestMap) : {};
}

function pick(stored: Partial<Record<string, unknown>>): Partial<Settings> {
  return Object.fromEntries(KEYS.filter((k) => k in stored).map((k) => [k, stored[k]]));
}

export type SettingsRepo = ReturnType<typeof settingsRepo>;
