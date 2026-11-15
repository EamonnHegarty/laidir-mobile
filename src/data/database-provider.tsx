import { randomUUID } from "expo-crypto";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { createContext, type ReactNode, use, useMemo } from "react";

import { systemClock } from "./clock";
import { expoDb } from "./expo-db";
import { createRepositories, type Repositories } from "./index";
import { migrate } from "./migrations";

export const DATABASE_NAME = "laidir.db";

const RepositoriesContext = createContext<Repositories | null>(null);

/** Opens the on-device database, runs migrations, then renders the app with repositories available. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={(sqlite) => migrate(expoDb(sqlite))}>
      <RepositoriesProvider>{children}</RepositoriesProvider>
    </SQLiteProvider>
  );
}

function RepositoriesProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const repositories = useMemo(
    () =>
      createRepositories({
        db: expoDb(sqlite),
        clock: systemClock,
        newId: () => randomUUID().toLowerCase(),
      }),
    [sqlite],
  );
  return <RepositoriesContext value={repositories}>{children}</RepositoriesContext>;
}

export function useRepositories(): Repositories {
  const repositories = use(RepositoriesContext);
  if (!repositories) throw new Error("useRepositories must be used inside DatabaseProvider");
  return repositories;
}
