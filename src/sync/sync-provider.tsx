import { useFocusEffect } from "expo-router";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

import { session, signIn, signOut } from "@/auth/sign-in";
import { useChangeFeed, useRepositories } from "@/data/database-provider";

import { createApi } from "./api";
import { createSyncController, type SyncController, type SyncState } from "./controller";

const SyncContext = createContext<SyncController | null>(null);

/** How often the open app checks for changes made elsewhere. */
export const POLL_MS = 60_000;
/** A screen coming into view syncs at most this often. */
export const FOCUS_SYNC_MS = 30_000;
let lastFocusSync = 0;

/**
 * Runs "Back up & sync" for the whole app: restores the session at start, syncs when the app comes
 * to the foreground, every POLL_MS while it's open, and shortly after local edits. Signed out, it
 * does nothing (the app is fully usable offline).
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const repos = useRepositories();
  const changes = useChangeFeed();
  const controller = useMemo(
    () =>
      createSyncController({
        session,
        api: createApi(session),
        repo: repos.sync,
        signIn,
        signOut,
      }),
    [repos],
  );

  useEffect(() => {
    void controller.start();
    const appState = AppState.addEventListener("change", (next) => {
      if (next === "active") void controller.syncNow();
    });
    const unsubscribe = changes.subscribe(() => controller.noteLocalChange());
    // While the app is open, check now and then for changes made elsewhere (another phone, or
    // Claude). Signed out or backing off, syncNow does nothing; an empty pull is one tiny request.
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void controller.syncNow();
    }, POLL_MS);
    return () => {
      appState.remove();
      unsubscribe();
      clearInterval(poll);
    };
  }, [controller, changes]);

  return <SyncContext value={controller}>{children}</SyncContext>;
}

/** Supplies a ready-made controller (tests use a fake through this). */
export function SyncControllerProvider({
  controller,
  children,
}: {
  controller: SyncController;
  children: ReactNode;
}) {
  return <SyncContext value={controller}>{children}</SyncContext>;
}

export function useSync(): { state: SyncState; controller: SyncController } {
  const controller = use(SyncContext);
  if (!controller) throw new Error("useSync must be used inside SyncProvider");
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return { state, controller };
}

/**
 * Pull-to-refresh for a list: syncs now (ignoring any backoff) when signed in. Signed out there's
 * nothing to fetch, so the spinner just closes.
 */
export function useSyncRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const controller = use(SyncContext);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = () => {
    if (!controller) return;
    setRefreshing(true);
    controller
      .syncNow({ force: true })
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };
  return { refreshing, onRefresh };
}

/** Syncs when the screen comes into view, at most every FOCUS_SYNC_MS across the app. */
export function useSyncOnFocus(): void {
  const controller = use(SyncContext);
  useFocusEffect(
    useCallback(() => {
      if (!controller || Date.now() - lastFocusSync < FOCUS_SYNC_MS) return;
      lastFocusSync = Date.now();
      void controller.syncNow();
    }, [controller]),
  );
}
