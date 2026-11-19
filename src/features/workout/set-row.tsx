import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/icon";
import { LiveField } from "@/components/live-field";
import { TimerField } from "@/components/timer-field";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { Tracking, WorkoutSet } from "@/data/contract";
import type { Settings } from "@/data/settings";
import { useTheme } from "@/hooks/use-theme";
import { durationInput, parseDecimal, parseWhole } from "@/lib/parse";
import { displayNumber, kgToUnit, unitToKg } from "@/lib/units";

import { fieldsFor } from "./session";

const METRES_PER_MILE = 1609.344;
const SWIPE_WIDTH = 88;

type Measures = Pick<WorkoutSet, "weight_kg" | "reps" | "duration_s" | "distance_m">;
type Units = Pick<Settings, "weight_unit" | "distance_unit">;

/**
 * One set while logging: its number (1, 2, 3…), last time's value, inputs for what the exercise
 * tracks (empty fields show a hint you can accept by ticking), and the done tick. Swipe it right to
 * left to delete it (long-press the set number, or the accessibility action, does the same).
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
  /** The set's position in the exercise: 1, 2, 3… */
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
  const label = String(number);
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
            style={[styles.field, { backgroundColor: theme.control }]}
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
            style={[styles.field, { backgroundColor: theme.control }]}
          />
        );
      case "duration_s":
        return (
          // Phone-timer entry: digits fill from the right, so 1000 is 10:00 and 130 is 1:30.
          <TimerField
            key={key}
            live
            seconds={set.duration_s}
            commit={(duration_s) => {
              if (duration_s !== undefined && duration_s > 86400) return false;
              onChange({ duration_s });
              return true;
            }}
            placeholder={hint.duration_s === undefined ? "m:ss" : durationInput(hint.duration_s)}
            accessibilityLabel={a11y("Time")}
            style={[styles.field, { backgroundColor: theme.control }]}
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
            style={[styles.field, { backgroundColor: theme.control }]}
          />
        );
    }
  });

  return (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={SWIPE_TO_DELETE}
      overshootRight={false}
      // Only a clear sideways drag to the left starts a swipe, so flicking the page up or down
      // never gets caught by a row (there is nothing to swipe to the right).
      dragOffsetFromRight={-24}
      dragOffsetFromLeft={10_000}
      onSwipeableOpen={onRemove}
      renderRightActions={() => (
        <View style={[styles.deleteAction, { backgroundColor: theme.danger }]}>
          <Icon name="delete" size={20} color={theme.onTint} />
          <Text style={[styles.deleteText, { color: theme.onTint }]}>Delete</Text>
        </View>
      )}
    >
      <View
        style={[
          styles.row,
          { backgroundColor: set.completed ? theme.doneRow : theme.backgroundElement },
        ]}
      >
        <Pressable
          onLongPress={() =>
            Alert.alert(`Remove set ${label}?`, undefined, [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: onRemove },
            ])
          }
          accessibilityHint="Long-press to remove the set."
          accessibilityActions={[{ name: "remove", label: "Remove set" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "remove") onRemove();
          }}
          accessibilityLabel={`Set ${label}`}
          style={styles.badge}
        >
          <Label size="heading">{label}</Label>
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
          style={[styles.tick, { backgroundColor: set.completed ? theme.success : theme.control }]}
        >
          <Icon name="check" size={22} color={set.completed ? theme.onTint : theme.textSecondary} />
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

/** How far (px) the row must be swiped left, and released, to delete the set. */
const SWIPE_TO_DELETE = 96;

/** Column headings matching LogSetRow's layout: Set · Last time · the tracked fields · tick. */
export function LogSetHeader({ tracking, units }: { tracking: Tracking; units: Units }) {
  const titles = fieldsFor(tracking).map((key) =>
    key === "weight_kg"
      ? units.weight_unit
      : key === "reps"
        ? "reps"
        : key === "duration_s"
          ? "time"
          : units.distance_unit === "km"
            ? "m"
            : "mi",
  );
  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants">
      <Label tone="secondary" size="small" style={[styles.badge, styles.center]}>
        Set
      </Label>
      <Label tone="secondary" size="small" style={styles.previous}>
        Last time
      </Label>
      {titles.map((title, i) => (
        <Label key={i} tone="secondary" size="small" style={[styles.field, styles.center]}>
          {title}
        </Label>
      ))}
      <View style={styles.tickSpace} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one + 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  badge: { width: 28, alignItems: "center" },
  center: { textAlign: "center" },
  // Last time and the inputs share the width left after the badge and tick, so weight and reps
  // stay readable on narrow phones.
  previous: { flex: 1.3, minWidth: 0 },
  field: { flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 4, textAlign: "center" },
  tickSpace: { width: 44 },
  deleteAction: {
    width: SWIPE_WIDTH,
    marginLeft: Spacing.one,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  deleteText: { fontSize: 12, fontWeight: 600 },
  tick: {
    width: 44,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
