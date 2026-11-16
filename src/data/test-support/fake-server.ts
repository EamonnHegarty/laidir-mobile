import type { components } from "@/generated/openapi";

import type { Profile } from "../contract";
import type { SyncItem } from "../sync";
import type { SyncApi } from "../sync-engine";
import { contractErrors } from "./contract-validator";

type PushResult = components["schemas"]["PushResult"];

type Stored = { item: SyncItem; seq: number };

/**
 * An in-memory laidir-api /v1 for one user, with the same rules as the real one: schema validation,
 * Profile id = sub, last writer wins on updated_at (equal = idempotent retry → applied), and a
 * feed ordered by the server's own write sequence with an opaque cursor.
 */
export function fakeServer(sub: string) {
  const items = new Map<string, Stored>();
  let seq = 0;
  const calls = { push: 0, pull: 0 };
  let failNext: Error | null = null;

  const key = (i: { type: string; id: string }) => `${i.type}#${i.id}`;
  const maybeFail = () => {
    if (failNext) {
      const error = failNext;
      failNext = null;
      throw error;
    }
  };

  const api: SyncApi & { profile(): Promise<Profile | undefined> } = {
    async push(batch) {
      calls.push++;
      maybeFail();
      if (batch.length > 25) throw new Error("server: more than 25 items");
      return batch.map((item): PushResult => {
        const errors = contractErrors(item);
        if (errors.length > 0 || (item.type === "PROFILE" && item.id !== sub)) {
          return {
            id: item.id,
            type: item.type,
            status: "invalid" as const,
            problem: {
              type: "about:blank",
              title: "Invalid item",
              status: 422,
              detail: errors[0] ?? "wrong id",
            },
          };
        }
        const current = items.get(key(item));
        if (current && !(current.item.updated_at < item.updated_at)) {
          if (current.item.updated_at === item.updated_at) {
            return { id: item.id, type: item.type, status: "applied" as const };
          }
          return {
            id: item.id,
            type: item.type,
            status: "stale" as const,
            current: structuredClone(current.item) as PushResult["current"],
          };
        }
        items.set(key(item), { item: structuredClone(item), seq: ++seq });
        return { id: item.id, type: item.type, status: "applied" as const };
      });
    },

    async pull(cursor, limit) {
      calls.pull++;
      maybeFail();
      const after = cursor ? Number(cursor.replace("c", "")) : 0;
      const feed = [...items.values()].filter((s) => s.seq > after).sort((a, b) => a.seq - b.seq);
      const page = feed.slice(0, limit);
      const last = page.at(-1)?.seq ?? after;
      return {
        items: page.map((s) => structuredClone(s.item)),
        next_cursor: `c${last}`,
        has_more: feed.length > limit,
      };
    },

    async profile() {
      return structuredClone(items.get(`PROFILE#${sub}`)?.item) as Profile | undefined;
    },
  };

  return {
    api,
    calls,
    /** Another device writes directly to the server. */
    write(item: SyncItem) {
      items.set(key(item), { item: structuredClone(item), seq: ++seq });
    },
    get(type: string, id: string): SyncItem | undefined {
      return items.get(`${type}#${id}`)?.item;
    },
    all: () => [...items.values()].map((s) => s.item),
    failNext(error: Error) {
      failNext = error;
    },
  };
}
