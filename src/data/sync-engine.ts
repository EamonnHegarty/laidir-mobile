import type { components } from "@/generated/openapi";

import type { SyncItem, SyncRepo } from "./sync";

type PushResult = components["schemas"]["PushResult"];

/** What the engine needs from the API (src/sync/api.ts implements it with fetch). */
export interface SyncApi {
  push(items: SyncItem[]): Promise<PushResult[]>;
  pull(
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: SyncItem[]; next_cursor: string; has_more: boolean }>;
}

export type SyncSummary = {
  pushed: number;
  pulled: number;
  /** Items the server rejected; they stay on the phone (dirty) and are retried next time. */
  invalid: { id: string; type: string; detail?: string }[];
};

/** The server takes at most 25 items per push. */
export const PUSH_BATCH = 25;
const PULL_PAGE = 200;
/** Safety caps for one run; whatever is left goes in the next run. */
const MAX_PUSH_BATCHES = 40;
const MAX_PULL_PAGES = 200;

/**
 * One sync: push everything changed on this phone, then pull everything changed on the server
 * since the stored cursor. Safe to interrupt at any point: pushes are idempotent, items are marked
 * clean only once accepted, and the cursor only moves after a page has been applied.
 */
export async function runSync({
  repo,
  api,
  sub,
}: {
  repo: SyncRepo;
  api: SyncApi;
  sub: string;
}): Promise<SyncSummary> {
  const summary: SyncSummary = { pushed: 0, pulled: 0, invalid: [] };

  // Push. Rejected items stay dirty, so skip them for the rest of this run.
  const skip = new Set<string>();
  for (let batch = 0; batch < MAX_PUSH_BATCHES; batch++) {
    const items = (await repo.pending(sub, PUSH_BATCH + skip.size))
      .filter((item) => !skip.has(key(item)))
      .slice(0, PUSH_BATCH);
    if (items.length === 0) break;

    const results = await api.push(items);
    const byKey = new Map(results.map((r) => [`${r.type}#${r.id}`, r]));
    for (const item of items) {
      const result = byKey.get(key(item));
      if (!result) {
        skip.add(key(item));
        continue;
      }
      switch (result.status) {
        case "applied":
          await repo.markPushed(item);
          summary.pushed++;
          break;
        case "stale":
          // The server has a newer copy: take it. (If this phone changed the item again meanwhile,
          // applyRemote keeps the newer local edit and it goes in a later batch.)
          if (result.current) await repo.applyRemote(result.current as SyncItem);
          else skip.add(key(item));
          break;
        case "invalid":
          skip.add(key(item));
          summary.invalid.push({ id: item.id, type: item.type, detail: result.problem?.detail });
          break;
      }
    }
  }

  // Pull.
  let cursor = await repo.cursor();
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const response = await api.pull(cursor, PULL_PAGE);
    for (const item of response.items) {
      if (await repo.applyRemote(item)) summary.pulled++;
    }
    cursor = response.next_cursor;
    await repo.setCursor(cursor);
    if (!response.has_more) break;
  }

  return summary;
}

const key = (item: { type: string; id: string }) => `${item.type}#${item.id}`;
