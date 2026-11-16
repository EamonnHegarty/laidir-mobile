import { API_BASE } from "@/auth/config";
import type { AuthSession } from "@/auth/session";
import type { Profile } from "@/data/contract";
import type { SyncItem } from "@/data/sync";
import type { SyncApi } from "@/data/sync-engine";
import type { components } from "@/generated/openapi";

type PullResponse = components["schemas"]["PullResponse"];
type PushResponse = components["schemas"]["PushResponse"];

/** The API answered with an error status. 429 means throttled (or the cost circuit breaker). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    detail?: string,
  ) {
    super(detail ? `API ${status}: ${detail}` : `API ${status}`);
    this.name = "ApiError";
  }
}

/** No connection, DNS failure, timeout. */
export class OfflineError extends Error {
  constructor(cause?: unknown) {
    super("No connection to Láidir's servers.", { cause });
    this.name = "OfflineError";
  }
}

/** Signed out (or the session expired) while calling the API. */
export class SignedOutError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "SignedOutError";
  }
}

const TIMEOUT_MS = 25_000;

export function createApi(session: AuthSession, fetchFn: typeof fetch = fetch) {
  async function call(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = await session.accessToken({ forceRefresh: retried });
    if (!token) throw new SignedOutError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchFn(`${API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      });
    } catch (error) {
      throw new OfflineError(error);
    } finally {
      clearTimeout(timer);
    }
    // A token the gateway rejects (e.g. revoked): refresh once and retry.
    if (res.status === 401 && !retried) return call(path, init, true);
    return res;
  }

  async function json<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let detail: string | undefined;
      try {
        detail = ((await res.json()) as { detail?: string }).detail;
      } catch {
        // Not a problem document.
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as T;
  }

  const api: SyncApi & { profile(): Promise<Profile | undefined> } = {
    async pull(cursor, limit) {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set("cursor", cursor);
      const body = await json<PullResponse>(await call(`/v1/sync?${params.toString()}`));
      return { ...body, items: body.items as SyncItem[] };
    },

    async push(items) {
      const body = await json<PushResponse>(
        await call("/v1/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        }),
      );
      return body.results;
    },

    /** The account's Profile, or undefined if it has none yet. */
    async profile() {
      const res = await call("/v1/profile");
      if (res.status === 404) return undefined;
      return json<Profile>(res);
    },
  };
  return api;
}

export type Api = ReturnType<typeof createApi>;
