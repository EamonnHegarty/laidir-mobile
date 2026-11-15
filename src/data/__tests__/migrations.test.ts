import type { DatabaseSync } from "node:sqlite";

import { migrate, migrations } from "../migrations";
import { nodeDb } from "../test-support/node-db";

const userVersion = (db: DatabaseSync) =>
  (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

const tableNames = (db: DatabaseSync) =>
  db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name);

describe("migrate", () => {
  it("creates the schema from an empty database", async () => {
    const db = nodeDb();
    await migrate(db);
    expect(userVersion(db.sqlite)).toBe(migrations.length);
    expect(tableNames(db.sqlite)).toEqual([
      "exercises",
      "routine_folders",
      "routines",
      "set_log",
      "settings",
      "workouts",
    ]);
  });

  it("is a no-op when already up to date", async () => {
    const db = nodeDb();
    await migrate(db);
    await migrate(db);
    expect(userVersion(db.sqlite)).toBe(migrations.length);
  });

  it("upgrades from every earlier version", async () => {
    for (let from = 0; from < migrations.length; from++) {
      const db = nodeDb();
      for (let v = 0; v < from; v++) {
        db.sqlite.exec(migrations[v]!);
        db.sqlite.exec(`PRAGMA user_version = ${v + 1}`);
      }
      await migrate(db);
      expect(userVersion(db.sqlite)).toBe(migrations.length);
    }
  });

  it("refuses a database from a newer app version", async () => {
    const db = nodeDb();
    db.sqlite.exec(`PRAGMA user_version = ${migrations.length + 1}`);
    await expect(migrate(db)).rejects.toThrow(/newer build/);
  });

  it("rolls back a failed migration and leaves the version unchanged", async () => {
    const db = nodeDb();
    db.sqlite.exec("CREATE TABLE workouts (id TEXT)"); // makes migration 1 fail part-way through
    await expect(migrate(db)).rejects.toThrow();
    expect(userVersion(db.sqlite)).toBe(0);
    expect(tableNames(db.sqlite)).toEqual(["workouts"]);
  });
});
