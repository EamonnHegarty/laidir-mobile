import { randomUUID } from "expo-crypto";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { systemClock } from "./clock";
import { expoDb } from "./expo-db";
import { createRepositories, type Repositories } from "./index";
import { type ChangeFeed, createChangeFeed, notifyingDb } from "./live";
import { migrate } from "./migrations";

export const DATABASE_NAME = "laidir.db";

type DataContextValue = { repositories: Repositories; changes: ChangeFeed };

const DataContext = createContext<DataContextValue | null>(null);

/** Opens the on-device database, runs migrations, then renders the app with repositories available. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={(sqlite) => migrate(expoDb(sqlite))}>
      <ExpoRepositories>{children}</ExpoRepositories>
    </SQLiteProvider>
  );
}

function ExpoRepositories({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const value = useMemo(() => {
    const changes = createChangeFeed();
    const repositories = createRepositories({
      db: notifyingDb(expoDb(sqlite), changes),
      clock: systemClock,
      newId: () => randomUUID().toLowerCase(),
    });
    return { repositories, changes };
  }, [sqlite]);
  return <DataContext value={value}>{children}</DataContext>;
}

/** Supplies ready-made repositories (tests use in-memory SQLite through this). */
export function RepositoriesProvider({
  value,
  children,
}: {
  value: DataContextValue;
  children: ReactNode;
}) {
  return <DataContext value={value}>{children}</DataContext>;
}

function useDataContext(): DataContextValue {
  const value = use(DataContext);
  if (!value) throw new Error("Data hooks must be used inside DatabaseProvider");
  return value;
}

export function useRepositories(): Repositories {
  return useDataContext().repositories;
}

/** The change feed: notified after every committed write (sync uses it to push edits soon). */
export function useChangeFeed(): ChangeFeed {
  return useDataContext().changes;
}

export type LiveQuery<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: T; error: undefined }
  | { status: "error"; data: T | undefined; error: Error };

/**
 * Runs `query` and re-runs it after any write anywhere in the app, or when `deps` change.
 * While re-running, the previous data stays visible.
 */
export function useLiveQuery<T>(
  query: (repositories: Repositories) => Promise<T>,
  deps: readonly unknown[],
): LiveQuery<T> {
  const { repositories, changes } = useDataContext();
  const version = useSyncExternalStore(changes.subscribe, changes.version);
  const [state, setState] = useState<LiveQuery<T>>({
    status: "loading",
    data: undefined,
    error: undefined,
  });

  useEffect(() => {
    let current = true;
    query(repositories).then(
      (data) => {
        if (current) setState({ status: "ready", data, error: undefined });
      },
      (error: unknown) => {
        if (current) {
          setState((prev) => ({
            status: "error",
            data: prev.data,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      },
    );
    return () => {
      current = false;
    };
    // `query` is usually an inline closure; `deps` lists what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories, version, ...deps]);

  return state;
}
