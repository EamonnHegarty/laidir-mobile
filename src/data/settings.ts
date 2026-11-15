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
  };
}

function pick(stored: Partial<Record<string, unknown>>): Partial<Settings> {
  return Object.fromEntries(KEYS.filter((k) => k in stored).map((k) => [k, stored[k]]));
}

export type SettingsRepo = ReturnType<typeof settingsRepo>;
