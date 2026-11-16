import type { Exercise, Profile, WorkoutExercise } from "../contract";
import { AccountMismatchError } from "../sync";
import { runSync } from "../sync-engine";
import { contractErrors, storedProblems } from "../test-support/contract-validator";
import { fakeServer } from "../test-support/fake-server";
import { setup } from "../test-support/setup";

const SUB = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER = "bbbbbbbb-2222-4222-8222-222222222222";
const ACCOUNT = { sub: SUB, email: "me@example.com" };

const cableFly = {
  name: "Cable fly",
  equipment: "cable",
  primary_muscle: "chest",
  tracking: "weight_reps",
} as const;

const squat = (weight_kg: number): WorkoutExercise => ({
  exercise_id: "builtin:barbell-back-squat",
  sets: [{ set_type: "normal", weight_kg, reps: 5, completed: true }],
});

async function signedIn() {
  const ctx = await setup();
  const server = fakeServer(SUB);
  await ctx.repos.sync.bindAccount(ACCOUNT, undefined);
  const sync = () => runSync({ repo: ctx.repos.sync, api: server.api, sub: SUB });
  return { ...ctx, server, sync };
}

describe("sync: first sign-in", () => {
  it("backs up everything made offline, and the settings become a valid Profile without local_ keys", async () => {
    const { repos, server, sync } = await setup().then(async (ctx) => {
      // Offline use before any account.
      await ctx.repos.settings.update({ weight_unit: "lb", default_rest_seconds: 90 });
      await ctx.repos.settings.setDisplayName("Eamonn");
      await ctx.repos.settings.setExerciseRest("builtin:leg-press", 180);
      await ctx.repos.settings.setAccent("Ómra" as never).catch(() => undefined);
      await ctx.repos.settings.setAppearance("dark");
      await ctx.repos.exercises.create(cableFly);
      const folder = await ctx.repos.routines.createFolder("PPL");
      await ctx.repos.routines.create({ name: "Push", folder_id: folder.id, exercises: [] });
      const w = await ctx.repos.workouts.start({ name: "Legs" });
      await ctx.repos.workouts.save(w.id, { name: "Legs", exercises: [squat(100)] });
      await ctx.repos.workouts.finish(w.id);

      const server = fakeServer(SUB);
      await ctx.repos.sync.bindAccount(ACCOUNT, await server.api.profile());
      return {
        ...ctx,
        server,
        sync: () => runSync({ repo: ctx.repos.sync, api: server.api, sub: SUB }),
      };
    });

    expect(await repos.sync.pendingCount()).toBe(5); // profile, exercise, folder, routine, workout
    const summary = await sync();
    expect(summary).toMatchObject({ pushed: 5, invalid: [] });
    expect(await repos.sync.pendingCount()).toBe(0);

    const profile = server.get("PROFILE", SUB) as Profile;
    expect(contractErrors(profile)).toEqual([]);
    expect(profile).toMatchObject({
      id: SUB,
      weight_unit: "lb",
      distance_unit: "km",
      default_rest_seconds: 90,
      display_name: "Eamonn",
      exercise_rest_seconds: { "builtin:leg-press": 180 },
    });
    expect(JSON.stringify(profile)).not.toMatch(/local_|accent|appearance/);
    expect(
      server
        .all()
        .map((i) => i.type)
        .sort(),
    ).toEqual(["EXERCISE", "PROFILE", "ROUTINE", "ROUTINE_FOLDER", "WORKOUT"]);
  });

  it("adopts the account's existing Profile instead of this phone's settings (second phone)", async () => {
    const { repos } = await setup();
    await repos.settings.update({ weight_unit: "lb" });
    const serverProfile: Profile = {
      id: SUB,
      type: "PROFILE",
      schema_version: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      deleted_at: null,
      weight_unit: "kg",
      distance_unit: "mi",
      display_name: "From phone one",
    };
    await repos.sync.bindAccount(ACCOUNT, serverProfile);
    expect(await repos.settings.get()).toMatchObject({ weight_unit: "kg", distance_unit: "mi" });
    expect(await repos.settings.displayName()).toBe("From phone one");
    expect(await repos.sync.pendingCount()).toBe(0);
  });

  it("belongs to the first account: another account is refused until the data is erased", async () => {
    const { repos } = await signedIn();
    await repos.exercises.create(cableFly);
    await repos.settings.setAppearance("dark");

    await expect(repos.sync.bindAccount({ sub: OTHER }, undefined)).rejects.toBeInstanceOf(
      AccountMismatchError,
    );
    // Same account again is fine.
    await repos.sync.bindAccount(ACCOUNT, undefined);

    await repos.sync.eraseSyncedData();
    expect(await repos.exercises.listAll()).toEqual([]);
    expect(await repos.sync.account()).toBeUndefined();
    expect(await repos.settings.appearance()).toBe("dark"); // device preference kept
    await repos.sync.bindAccount({ sub: OTHER }, undefined);
    expect(await repos.sync.account()).toEqual({ sub: OTHER });
  });
});

describe("sync: push and pull", () => {
  it("only marks an item clean if it didn't change while the push was in flight", async () => {
    const { repos, server, clock } = await signedIn();
    const ex = await repos.exercises.create(cableFly);
    const sent = (await repos.sync.pending(SUB, 25)).find((i) => i.id === ex.id)!;
    clock.advance(1000);
    await repos.exercises.update(ex.id, { ...cableFly, name: "Cable fly (high)" });

    await server.api.push([sent]);
    await repos.sync.markPushed(sent);
    const still = await repos.sync.pending(SUB, 25);
    expect(still.map((i) => i.id)).toContain(ex.id);
  });

  it("pulls another phone's changes, newest wins, and an unpushed newer local edit is kept", async () => {
    const { repos, server, clock, sync } = await signedIn();
    const mine = await repos.exercises.create(cableFly);
    const theirs = await repos.exercises.create({ ...cableFly, name: "Pec deck" });
    await sync();

    // Phone two renames both (later than phone one's copies).
    clock.advance(60_000);
    server.write({ ...mine, name: "Renamed on phone two", updated_at: clock.now() } as Exercise);
    server.write({ ...theirs, name: "Pec deck (phone two)", updated_at: clock.now() } as Exercise);
    // Meanwhile this phone edits `theirs` again, even later, offline.
    clock.advance(60_000);
    await repos.exercises.update(theirs.id, { ...cableFly, name: "Pec deck (this phone)" });

    await sync();
    expect((await repos.exercises.get(mine.id))!.name).toBe("Renamed on phone two");
    expect((await repos.exercises.get(theirs.id))!.name).toBe("Pec deck (this phone)");
    expect(server.get("EXERCISE", theirs.id)).toMatchObject({ name: "Pec deck (this phone)" });
    expect(await repos.sync.pendingCount()).toBe(0);
  });

  it("takes the server copy when a push is stale", async () => {
    const { repos, server, clock, sync } = await signedIn();
    const ex = await repos.exercises.create(cableFly);
    await sync();
    // The server has a newer copy this phone hasn't pulled yet; this phone's edit is older.
    server.write({ ...ex, name: "Newer elsewhere", updated_at: "2027-01-01T00:00:00.000Z" });
    clock.advance(1000);
    await repos.exercises.update(ex.id, { ...cableFly, name: "Older here" });

    await sync();
    expect((await repos.exercises.get(ex.id))!.name).toBe("Newer elsewhere");
    expect(await repos.sync.pendingCount()).toBe(0);
  });

  it("applies pulled workouts to history and stats (set_log), and pulled tombstones delete", async () => {
    const { repos, server, clock, sync, db } = await signedIn();
    await sync();
    const workout = {
      id: "cccccccc-0000-4000-8000-000000000001",
      type: "WORKOUT" as const,
      schema_version: 1 as const,
      created_at: clock.now(),
      updated_at: clock.now(),
      deleted_at: null,
      name: "From phone two",
      started_at: "2026-11-14T08:00:00.000Z",
      ended_at: "2026-11-14T09:00:00.000Z",
      exercises: [squat(120)],
    };
    server.write(workout);
    await sync();
    expect((await repos.workouts.listHistory()).map((w) => w.name)).toEqual(["From phone two"]);
    expect(await repos.workouts.lastPerformance("builtin:barbell-back-squat")).toHaveLength(1);

    clock.advance(1000);
    server.write({ ...workout, deleted_at: clock.now(), updated_at: clock.now() });
    await sync();
    expect(await repos.workouts.listHistory()).toEqual([]);
    expect(await repos.workouts.lastPerformance("builtin:barbell-back-squat")).toEqual([]);
    expect(await storedProblems(db)).toEqual([]);
  });

  it("pulls in pages and keeps the cursor, so the next sync only gets new changes", async () => {
    const { repos, server, clock, sync } = await signedIn();
    for (let n = 0; n < 450; n++) {
      server.write({
        id: `dddddddd-0000-4000-8000-${n.toString().padStart(12, "0")}`,
        type: "EXERCISE",
        schema_version: 1,
        created_at: clock.now(),
        updated_at: clock.now(),
        deleted_at: null,
        ...cableFly,
        name: `Exercise ${n}`,
      });
    }
    const first = await sync();
    expect(first.pulled).toBe(450);
    expect(await repos.exercises.listAll()).toHaveLength(450);
    expect(await repos.sync.pendingCount()).toBe(0);

    const pullsBefore = server.calls.pull;
    const second = await sync();
    expect(second).toMatchObject({ pushed: 0, pulled: 0 });
    expect(server.calls.pull - pullsBefore).toBe(1);
  });

  it("pushes in batches of 25", async () => {
    const { repos, server, sync } = await signedIn();
    for (let n = 0; n < 60; n++) await repos.exercises.create({ ...cableFly, name: `E${n}` });
    const summary = await sync();
    expect(summary.pushed).toBe(61); // + the Profile
    expect(server.calls.push).toBe(3);
  });

  it("keeps rejected items on the phone and still syncs the rest", async () => {
    const { repos, server, sync, db } = await signedIn();
    const good = await repos.exercises.create(cableFly);
    const bad = await repos.exercises.create({ ...cableFly, name: "Broken" });
    // Corrupt one stored doc so the server rejects it.
    await db.run("UPDATE exercises SET doc = json_set(doc, '$.colour', 'red') WHERE id = ?", [
      bad.id,
    ]);

    const summary = await sync();
    expect(summary.invalid).toEqual([expect.objectContaining({ id: bad.id, type: "EXERCISE" })]);
    expect(server.get("EXERCISE", good.id)).toBeDefined();
    expect(server.get("EXERCISE", bad.id)).toBeUndefined();
    expect(await repos.sync.pendingCount()).toBe(1);
  });

  it("marks the Profile changed only for Profile fields, once signed in", async () => {
    const { repos, sync } = await signedIn();
    await sync();
    await repos.settings.setAccent("Rós" as never).catch(() => undefined);
    await repos.settings.setAppearance("light");
    await repos.settings.setRestAlert("silent");
    expect(await repos.sync.pendingCount()).toBe(0);
    await repos.settings.update({ distance_unit: "mi" });
    expect(await repos.sync.pendingCount()).toBe(1);
  });

  it("resumes safely after a failed pull: nothing is lost and the cursor doesn't move", async () => {
    const { repos, server, sync } = await signedIn();
    await repos.exercises.create(cableFly);
    server.failNext(new Error("offline"));
    await expect(sync()).rejects.toThrow("offline");
    expect(await repos.sync.pendingCount()).toBe(2);
    await sync();
    expect(await repos.sync.pendingCount()).toBe(0);
  });
});
