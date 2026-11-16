import { type AuthSession, type SessionAccount, SessionExpiredError } from "@/auth/session";
import type { Profile } from "@/data/contract";
import { AccountMismatchError, type Account, type SyncRepo } from "@/data/sync";
import { runSync, type SyncApi } from "@/data/sync-engine";

import { ApiError, OfflineError, SignedOutError } from "./api";

/**
 * Drives "Back up & sync": sign-in, linking this phone's data to the account, and running sync
 * (on start, when the app comes to the foreground, shortly after edits, and on demand), with
 * backoff after failures. Plain TypeScript; SyncProvider wires it into React.
 */
export type SyncState =
  | { kind: "loading" }
  | { kind: "signed-out"; message?: string }
  | { kind: "signing-in" }
  | {
      /** This phone's data belongs to another account; the user chooses erase or cancel. */
      kind: "mismatch";
      account: SessionAccount;
      existing: Account;
    }
  | {
      kind: "signed-in";
      account: SessionAccount;
      syncing: boolean;
      lastSyncedAt?: number;
      /** Changes on this phone not yet backed up. */
      pending: number;
      /** Items the server rejected (kept on the phone). */
      rejected: number;
      error?: string;
    };

export interface SyncControllerDeps {
  session: AuthSession;
  api: SyncApi & { profile(): Promise<Profile | undefined> };
  repo: SyncRepo;
  signIn: () => Promise<
    | { type: "success"; account: SessionAccount }
    | { type: "cancel" }
    | { type: "error"; message: string }
  >;
  signOut: () => Promise<void>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

/** Wait this long after an edit before pushing it (edits come in bursts during a workout). */
export const EDIT_DEBOUNCE_MS = 20_000;
const BACKOFF_MIN_MS = 30_000;
const BACKOFF_MAX_MS = 15 * 60_000;

export function createSyncController(deps: SyncControllerDeps) {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let state: SyncState = { kind: "loading" };
  let running: Promise<void> | null = null;
  let again = false;
  let timer: unknown = null;
  let failures = 0;
  let blockedUntil = 0;
  const listeners = new Set<() => void>();

  const set = (next: SyncState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const signedIn = (patch: Partial<Extract<SyncState, { kind: "signed-in" }>> = {}) => {
    const account = deps.session.account();
    if (!account) return;
    const prev = state.kind === "signed-in" ? state : undefined;
    set({
      kind: "signed-in",
      account,
      syncing: prev?.syncing ?? false,
      lastSyncedAt: prev?.lastSyncedAt,
      pending: prev?.pending ?? 0,
      rejected: prev?.rejected ?? 0,
      error: prev?.error,
      ...patch,
    });
  };

  const schedule = (ms: number) => {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void controller.syncNow();
    }, ms);
  };

  /** Links this phone's data to `account`. Returns false if the user has to choose (mismatch). */
  async function link(account: SessionAccount): Promise<boolean> {
    const existing = await deps.repo.account();
    if (existing?.sub === account.sub) return true;
    if (existing) {
      set({ kind: "mismatch", account, existing });
      return false;
    }
    const profile = await deps.api.profile();
    try {
      await deps.repo.bindAccount(account, profile);
      return true;
    } catch (error) {
      if (error instanceof AccountMismatchError) {
        set({ kind: "mismatch", account, existing: error.existing });
        return false;
      }
      throw error;
    }
  }

  async function runOnce(): Promise<void> {
    const account = deps.session.account();
    if (!account || state.kind === "mismatch") return;
    signedIn({ syncing: true, error: undefined });
    try {
      if (!(await link(account))) return;
      const summary = await runSync({ repo: deps.repo, api: deps.api, sub: account.sub });
      failures = 0;
      blockedUntil = 0;
      signedIn({
        syncing: false,
        lastSyncedAt: now(),
        pending: await deps.repo.pendingCount(),
        rejected: summary.invalid.length,
        error: undefined,
      });
    } catch (error) {
      if (error instanceof SessionExpiredError || error instanceof SignedOutError) {
        set({
          kind: "signed-out",
          message: "Your sign-in expired. Sign in again to keep syncing.",
        });
        return;
      }
      failures++;
      const delay = Math.min(BACKOFF_MIN_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
      blockedUntil = now() + delay;
      schedule(delay);
      signedIn({
        syncing: false,
        pending: await deps.repo.pendingCount().catch(() => 0),
        error: describe(error),
      });
    }
  }

  const controller = {
    getState: () => state,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Call once at app start: restores the session and syncs. */
    async start(): Promise<void> {
      const account = await deps.session.load();
      if (!account) {
        set({ kind: "signed-out" });
        return;
      }
      signedIn({ pending: await deps.repo.pendingCount() });
      await controller.syncNow();
    },

    /** Runs a sync now (or right after the one in progress). `force` ignores the backoff. */
    async syncNow({ force = false } = {}): Promise<void> {
      if (state.kind !== "signed-in") return;
      if (!force && now() < blockedUntil) return;
      if (running) {
        again = true;
        return running;
      }
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      running = (async () => {
        do {
          again = false;
          await runOnce();
        } while (again && state.kind === "signed-in" && !state.error);
      })().finally(() => {
        running = null;
      });
      return running;
    },

    /** Something changed locally: push it soon (debounced). Ignored while signed out or syncing. */
    noteLocalChange(): void {
      if (state.kind !== "signed-in" || running) return;
      if (now() < blockedUntil) return;
      schedule(EDIT_DEBOUNCE_MS);
    },

    async signIn(): Promise<void> {
      set({ kind: "signing-in" });
      const result = await deps.signIn();
      if (result.type === "cancel") {
        set({ kind: "signed-out" });
        return;
      }
      if (result.type === "error") {
        set({ kind: "signed-out", message: result.message });
        return;
      }
      signedIn({ syncing: true });
      await controller.syncNow({ force: true });
    },

    /** Keeps this phone's data and the account link; stops syncing. */
    async signOut(): Promise<void> {
      if (timer !== null) clearTimer(timer);
      timer = null;
      await deps.signOut();
      set({ kind: "signed-out" });
    },

    /** Mismatch: erase this phone's synced data, link it to the new account, then download. */
    async eraseAndContinue(): Promise<void> {
      if (state.kind !== "mismatch") return;
      await deps.repo.eraseSyncedData();
      signedIn({ syncing: true, pending: 0, rejected: 0, lastSyncedAt: undefined });
      await controller.syncNow({ force: true });
    },

    /** Mismatch: keep this phone's data and sign the new account out again. */
    async cancelMismatch(): Promise<void> {
      if (state.kind !== "mismatch") return;
      await deps.signOut();
      set({ kind: "signed-out" });
    },
  };
  return controller;
}

function describe(error: unknown): string {
  if (error instanceof OfflineError) return "Offline. Will try again.";
  if (error instanceof ApiError && error.status === 429) {
    return "The server is busy. Will try again.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "The server had a problem. Will try again.";
  }
  return error instanceof Error ? error.message : String(error);
}

export type SyncController = ReturnType<typeof createSyncController>;
