import { Pressable, StyleSheet, View } from "react-native";

import { LiveField } from "@/components/live-field";
import { IconButton, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { SetType, Tracking, WorkoutSet } from "@/data/contract";
import type { Settings } from "@/data/settings";
import { useTheme } from "@/hooks/use-theme";
import { SET_TYPE_LABELS } from "@/lib/labels";
import { durationInput, parseDecimal, parseDuration, parseWhole } from "@/lib/parse";
import { displayNumber, kgToUnit, unitToKg } from "@/lib/units";

import { fieldsFor } from "./session";

const SET_TYPES: SetType[] = ["normal", "warmup", "drop", "failure"];
const SHORT: Record<SetType, string> = { normal: "", warmup: "W", drop: "D", failure: "F" };
const METRES_PER_MILE = 1609.344;

type Measures = Pick<WorkoutSet, "weight_kg" | "reps" | "duration_s" | "distance_m">;
type Units = Pick<Settings, "weight_unit" | "distance_unit">;

/**
 * One set while logging: type badge, last time's value, inputs for what the exercise tracks
 * (empty fields show a hint you can accept by ticking), and the done tick.
 */
export function LogSetRow({
  number,
  set,
  tracking,
  hint,
  previous,
  units,
  exerciseName,
  onChange,
  onToggle,
  onRemove,
}: {
  /** Working-set number (warm-ups, drops and failure sets show a letter instead). */
  number: number;
  set: WorkoutSet;
  tracking: Tracking;
  hint: Measures;
  /** Last time's set at this position, already formatted, or undefined. */
  previous?: string;
  units: Units;
  exerciseName: string;
  onChange: (changes: Partial<WorkoutSet>) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const label = SHORT[set.set_type] || String(number);
  const nextType = SET_TYPES[(SET_TYPES.indexOf(set.set_type) + 1) % SET_TYPES.length]!;
  const a11y = (what: string) => `${what}, set ${label}, ${exerciseName}`;
  const distanceInMetres = units.distance_unit === "km";

  const fields = fieldsFor(tracking).map((key) => {
    switch (key) {
      case "weight_kg":
        return (
          <LiveField
            key={key}
            value={set.weight_kg}
            format={(kg) => displayNumber(kgToUnit(kg, units.weight_unit))}
            parse={(text) => {
              const v = parseDecimal(text);
              if (v === null || v === undefined) return v;
              const kg = unitToKg(v, units.weight_unit);
              return kg > 1000 ? null : kg;
            }}
            onValue={(weight_kg) => onChange({ weight_kg })}
            placeholder={
              hint.weight_kg === undefined
                ? units.weight_unit
                : displayNumber(kgToUnit(hint.weight_kg, units.weight_unit))
            }
            accessibilityLabel={a11y(`Weight in ${units.weight_unit}`)}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        );
      case "reps":
        return (
          <LiveField
            key={key}
            value={set.reps}
            format={String}
            parse={(text) => {
              const v = parseWhole(text);
              return v !== undefined && v !== null && v > 1000 ? null : v;
            }}
            onValue={(reps) => onChange({ reps })}
            placeholder={hint.reps === undefined ? "reps" : String(hint.reps)}
            accessibilityLabel={a11y("Reps")}
            keyboardType="number-pad"
            style={styles.field}
          />
        );
      case "duration_s":
        return (
          <LiveField
            key={key}
            value={set.duration_s}
            format={durationInput}
            parse={(text) => {
              const v = parseDuration(text);
              return v !== undefined && v !== null && v > 86400 ? null : v;
            }}
            onValue={(duration_s) => onChange({ duration_s })}
            placeholder={hint.duration_s === undefined ? "m:ss" : durationInput(hint.duration_s)}
            accessibilityLabel={a11y("Time")}
            keyboardType="numbers-and-punctuation"
            style={styles.field}
          />
        );
      case "distance_m":
        return (
          <LiveField
            key={key}
            value={set.distance_m}
            format={(m) => displayNumber(distanceInMetres ? m : m / METRES_PER_MILE)}
            parse={(text) => {
              const v = parseDecimal(text);
              if (v === null || v === undefined) return v;
              const m = distanceInMetres ? v : v * METRES_PER_MILE;
              return m > 1_000_000 ? null : m;
            }}
            onValue={(distance_m) => onChange({ distance_m })}
            placeholder={
              hint.distance_m === undefined
                ? distanceInMetres
                  ? "m"
                  : "mi"
                : displayNumber(
                    distanceInMetres ? hint.distance_m : hint.distance_m / METRES_PER_MILE,
                  )
            }
            accessibilityLabel={a11y(distanceInMetres ? "Distance in metres" : "Distance in miles")}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        );
    }
  });

  return (
    <View style={[styles.row, set.completed && { backgroundColor: theme.doneRow }]}>
      <Pressable
        onPress={() => onChange({ set_type: nextType })}
        accessibilityRole="button"
        accessibilityLabel={`${SET_TYPE_LABELS[set.set_type]} set ${label}. Change to ${SET_TYPE_LABELS[nextType]}`}
        style={styles.badge}
      >
        <Label tone={set.set_type === "normal" ? "default" : "tint"} size="heading">
          {label}
        </Label>
      </Pressable>
      <Label tone="secondary" size="small" style={styles.previous} numberOfLines={1}>
        {previous ?? "—"}
      </Label>
      {fields}
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={a11y("Done")}
        hitSlop={6}
        style={[styles.tick, { backgroundColor: set.completed ? theme.success : theme.background }]}
      >
        <Label style={{ color: set.completed ? theme.onTint : theme.textSecondary }} size="heading">
          ✓
        </Label>
      </Pressable>
      <IconButton label="−" a11y={a11y("Remove")} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  badge: { width: 32, alignItems: "center" },
  previous: { width: 72 },
  field: { flex: 1, paddingVertical: 8, textAlign: "center" },
  tick: {
    width: 44,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
