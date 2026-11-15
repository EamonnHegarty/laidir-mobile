import { createRepositories } from "../index";
import { createChangeFeed, notifyingDb } from "../live";
import { migrate } from "../migrations";
import { nodeDb } from "../test-support/node-db";
import { testClock, testIds } from "../test-support/setup";

describe("change feed", () => {
  it("notifies once per committed write, not per statement", async () => {
    const raw = nodeDb();
    await migrate(raw);
    const feed = createChangeFeed();
    const seen: number[] = [];
    feed.subscribe(() => seen.push(feed.version()));
    const repos = createRepositories({
      db: notifyingDb(raw, feed),
      clock: testClock(),
      newId: testIds(),
    });

    const folder = await repos.routines.createFolder("PPL");
    await repos.routines.create({ name: "Push", folder_id: folder.id, exercises: [] });
    await repos.routines.create({ name: "Pull", folder_id: folder.id, exercises: [] });
    expect(seen).toEqual([1, 2, 3]);

    // Three writes in one transaction: one notification.
    await repos.routines.removeFolder(folder.id);
    expect(seen).toEqual([1, 2, 3, 4]);

    // Reads and failed writes notify nobody.
    await repos.routines.listGrouped();
    await expect(
      repos.exercises.update("missing", {
        name: "x",
        equipment: "barbell",
        primary_muscle: "chest",
        tracking: "weight_reps",
      }),
    ).rejects.toThrow();
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});
