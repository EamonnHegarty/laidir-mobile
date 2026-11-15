import type { Profile } from "./contract";
import type { Db } from "./db";

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

export function settingsRepo({ db }: { db: Db }) {
  return {
    async get(): Promise<Settings> {
      const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings");
      const stored: Partial<Record<string, unknown>> = {};
      for (const row of rows) stored[row.key] = JSON.parse(row.value);
      return { ...DEFAULT_SETTINGS, ...pick(stored) };
    },

    async update(changes: Partial<Settings>): Promise<Settings> {
      await db.transaction(async (tx) => {
        for (const key of KEYS) {
          const value = changes[key];
          if (value === undefined) continue;
          await tx.run(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [key, JSON.stringify(value)],
          );
        }
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
      });
    },
  };
}

/** Profile field name, and its limits from the contract (RestSeconds, maxProperties). */
const REST_KEY = "exercise_rest_seconds";
const MAX_REST = 3600;
const MAX_EXERCISE_RESTS = 500;

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
