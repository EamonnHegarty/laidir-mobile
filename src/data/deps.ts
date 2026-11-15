import type { Clock } from "./clock";
import type { Db } from "./db";

export type Deps = {
  db: Db;
  clock: Clock;
  /** Returns a new lowercase UUID (the contract's Uuid format). */
  newId: () => string;
};
