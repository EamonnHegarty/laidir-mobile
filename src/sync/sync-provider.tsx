import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";

import { session, signIn, signOut } from "@/auth/sign-in";
import { useChangeFeed, useRepositories } from "@/data/database-provider";

import { createApi } from "./api";
import { createSyncController, type SyncController, type SyncState } from "./controller";

const SyncContext = createContext<SyncController | null>(null);

/**
 * Runs "Back up & sync" for the whole app: restores the session at start, syncs when the app comes
 * to the foreground and shortly after local edits. Signed out, it does nothing (the app is fully
 * usable offline).
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
    return () => {
      appState.remove();
      unsubscribe();
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
