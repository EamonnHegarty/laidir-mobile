// Validates documents against the pinned laidir-api JSON Schemas in contract/.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

import type { Entity } from "../contract";
import type { Db } from "../db";

const contractDir = join(__dirname, "../../../contract");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as { $id: string };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schemaDir = join(contractDir, "schemas/v1");
for (const file of readdirSync(schemaDir)) ajv.addSchema(readJson(join(schemaDir, file)));
const catalogueSchema = readJson(join(contractDir, "catalogue/v1/exercises.schema.json"));
ajv.addSchema(catalogueSchema);

const schemaIdFor: Record<Entity["type"], string> = {
  EXERCISE: "Exercise.json",
  ROUTINE_FOLDER: "RoutineFolder.json",
  ROUTINE: "Routine.json",
  WORKOUT: "Workout.json",
};
const BASE = "https://raw.githubusercontent.com/EamonnHegarty/laidir-api/main/schemas/v1/";

export const entityTypes = Object.keys(schemaIdFor) as Entity["type"][];

/** Contract errors for a document, or [] if it's a valid v1 item of its `type`. */
export function contractErrors(doc: { type: string }): string[] {
  const file = schemaIdFor[doc.type as Entity["type"]];
  if (!file) return [`unknown type ${doc.type}`];
  const validate = ajv.getSchema(BASE + file);
  if (!validate) throw new Error(`schema ${file} not loaded`);
  if (validate(doc)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`);
}

export function catalogueErrors(catalogue: unknown): string[] {
  const validate = ajv.getSchema(catalogueSchema.$id);
  if (!validate) throw new Error("catalogue schema not loaded");
  if (validate(catalogue)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`);
}

const TABLES = ["exercises", "routine_folders", "routines", "workouts"];

/**
 * Checks every stored row: its doc is a valid v1 item, and the copied query columns match the doc.
 * Returns problems as strings so a failing test shows all of them.
 */
export async function storedProblems(db: Db): Promise<string[]> {
  const problems: string[] = [];
  for (const table of TABLES) {
    const rows = await db.all<Record<string, unknown> & { doc: string }>(`SELECT * FROM ${table}`);
    for (const row of rows) {
      const doc = JSON.parse(row.doc) as Record<string, unknown> & { type: string };
      for (const error of contractErrors(doc))
        problems.push(`${table}/${String(row.id)}: ${error}`);
      for (const [column, value] of Object.entries(row)) {
        if (column === "doc" || column === "dirty") continue;
        const expected = doc[column] ?? null;
        if (value !== expected) {
          problems.push(
            `${table}/${String(row.id)}: column ${column}=${String(value)}, doc has ${String(expected)}`,
          );
        }
      }
    }
  }
  return problems;
}
