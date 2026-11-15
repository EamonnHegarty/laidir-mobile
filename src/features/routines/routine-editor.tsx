import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CommitField } from "@/components/commit-field";
import { Button, Chip, ChipGrid, Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, RoutineFolder, RoutineSet, SetType, Tracking } from "@/data/contract";
import type { Settings } from "@/data/settings";
import { useTheme } from "@/hooks/use-theme";
import { SET_TYPE_LABELS } from "@/lib/labels";
import {
  durationInput,
  formatRepRange,
  parseDecimal,
  parseDuration,
  parseRepRange,
} from "@/lib/parse";
import { displayNumber, kgToUnit, unitToKg } from "@/lib/units";

import {
  addSet,
  MAX_EXERCISES,
  MAX_SETS,
  moveExercise,
  removeExercise,
  removeSet,
  type RoutineDraft,
  updateExercise,
  updateSet,
} from "./draft";

const SET_TYPES: SetType[] = ["normal", "warmup", "drop", "failure"];
const SET_TYPE_SHORT: Record<SetType, string> = {
  normal: "",
  warmup: "W",
  drop: "D",
  failure: "F",
};

type Props = {
  draft: RoutineDraft;
  onChange: (draft: RoutineDraft) => void;
  folders: readonly RoutineFolder[];
  /** The user's custom exercises, including deleted ones, to name any exercise_id. */
  customExercises: ReadonlyMap<string, Exercise>;
  units: Pick<Settings, "weight_unit" | "distance_unit">;
  onAddExercises: () => void;
  problem?: string;
};

export function RoutineEditor({
  draft,
  onChange,
  folders,
  customExercises,
  units,
  onAddExercises,
  problem,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Field
        value={draft.name}
        onChangeText={(name) => onChange({ ...draft, name })}
        placeholder="Workout name, e.g. Push"
        accessibilityLabel="Workout name"
        maxLength={100}
        style={styles.name}
      />

      {folders.length > 0 ? (
        <View style={styles.section}>
          <Label tone="secondary" size="small">
            Program
          </Label>
          <ChipGrid>
            <Chip
              label="None"
              selected={draft.folder_id === undefined}
              onPress={() => onChange({ ...draft, folder_id: undefined })}
            />
            {folders.map((folder) => (
              <Chip
                key={folder.id}
                label={folder.name}
                selected={draft.folder_id === folder.id}
                onPress={() => onChange({ ...draft, folder_id: folder.id })}
              />
            ))}
          </ChipGrid>
        </View>
      ) : null}

      {draft.exercises.map((exercise, index) => {
        const info = describeExercise(
          exercise.exercise_id,
          customExercises.get(exercise.exercise_id),
        );
        return (
          <ExerciseCard
            key={`${exercise.exercise_id}-${index}`}
            name={info.name}
            tracking={info.tracking}
            sets={exercise.sets}
            restSeconds={exercise.rest_seconds}
            units={units}
            first={index === 0}
            last={index === draft.exercises.length - 1}
            onMove={(by) => onChange(moveExercise(draft, index, by))}
            onRemove={() => onChange(removeExercise(draft, index))}
            onRest={(rest_seconds) => onChange(updateExercise(draft, index, { rest_seconds }))}
            onAddSet={() => onChange(addSet(draft, index))}
            onRemoveSet={(s) => onChange(removeSet(draft, index, s))}
            onSet={(s, changes) => onChange(updateSet(draft, index, s, changes))}
          />
        );
      })}

      {draft.exercises.length < MAX_EXERCISES ? (
        <Button title="Add exercises" onPress={onAddExercises} />
      ) : null}

      <Field
        value={draft.notes}
        onChangeText={(notes) => onChange({ ...draft, notes })}
        placeholder="Notes (optional)"
        accessibilityLabel="Workout notes"
        multiline
        maxLength={2000}
        style={styles.notes}
      />

      {problem ? (
        <Label tone="danger" accessibilityLiveRegion="polite">
          {problem}
        </Label>
      ) : null}
    </ScrollView>
  );
}

function ExerciseCard({
  name,
  tracking,
  sets,
  restSeconds,
  units,
  first,
  last,
  onMove,
  onRemove,
  onRest,
  onAddSet,
  onRemoveSet,
  onSet,
}: {
  name: string;
  tracking: Tracking;
  sets: RoutineSet[];
  restSeconds?: number;
  units: Props["units"];
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onRest: (seconds: number | undefined) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
  onSet: (index: number, changes: Partial<RoutineSet>) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHeader}>
        <Label size="heading" style={styles.flex}>
          {name}
        </Label>
        <IconButton
          label="↑"
          a11y={`Move ${name} up`}
          onPress={() => onMove(-1)}
          disabled={first}
        />
        <IconButton
          label="↓"
          a11y={`Move ${name} down`}
          onPress={() => onMove(1)}
          disabled={last}
        />
        <IconButton label="✕" a11y={`Remove ${name}`} onPress={onRemove} />
      </View>

      <View style={styles.restRow}>
        <Label tone="secondary" size="small">
          Rest
        </Label>
        <CommitField
          value={durationInput(restSeconds)}
          commit={(text) => {
            const seconds = parseDuration(text);
            if (seconds === null || (seconds ?? 0) > 3600) return false;
            onRest(seconds);
            return true;
          }}
          placeholder="default"
          accessibilityLabel={`Rest time for ${name}`}
          keyboardType="numbers-and-punctuation"
          style={styles.restField}
        />
      </View>

      {sets.map((set, index) => (
        <SetRow
          key={index}
          number={sets.slice(0, index + 1).filter((s) => s.set_type !== "warmup").length}
          set={set}
          tracking={tracking}
          units={units}
          exerciseName={name}
          canRemove={sets.length > 1}
          onChange={(changes) => onSet(index, changes)}
          onRemove={() => onRemoveSet(index)}
        />
      ))}
      {sets.length < MAX_SETS ? <Button title="Add set" tone="plain" onPress={onAddSet} /> : null}
    </View>
  );
}

function SetRow({
  number,
  set,
  tracking,
  units,
  exerciseName,
  canRemove,
  onChange,
  onRemove,
}: {
  number: number;
  set: RoutineSet;
  tracking: Tracking;
  units: Props["units"];
  exerciseName: string;
  canRemove: boolean;
  onChange: (changes: Partial<RoutineSet>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const nextType = SET_TYPES[(SET_TYPES.indexOf(set.set_type) + 1) % SET_TYPES.length]!;
  const label = SET_TYPE_SHORT[set.set_type] || String(number);
  const usesWeight = [
    "weight_reps",
    "weighted_bodyweight",
    "assisted_bodyweight",
    "weight_distance",
  ].includes(tracking);
  const usesReps = [
    "weight_reps",
    "reps_only",
    "weighted_bodyweight",
    "assisted_bodyweight",
  ].includes(tracking);
  const usesDuration = tracking === "duration" || tracking === "distance_duration";
  const usesDistance = tracking === "distance_duration" || tracking === "weight_distance";
  const distanceUnit = units.distance_unit === "km" ? "m" : "mi";
  const a11y = (what: string) => `${what}, set ${label}, ${exerciseName}`;

  return (
    <View style={styles.setRow}>
      <Pressable
        onPress={() => onChange({ set_type: nextType })}
        accessibilityRole="button"
        accessibilityLabel={`${SET_TYPE_LABELS[set.set_type]} set ${label}. Change to ${SET_TYPE_LABELS[nextType]}`}
        style={[styles.setType, { backgroundColor: theme.background }]}
      >
        <Label tone={set.set_type === "normal" ? "default" : "tint"}>{label}</Label>
      </Pressable>

      {usesReps ? (
        <CommitField
          value={formatRepRange({ min: set.target_reps_min, max: set.target_reps_max })}
          commit={(text) => {
            const range = parseRepRange(text);
            if (!range || (range.max ?? 0) > 1000) return false;
            onChange({ target_reps_min: range.min, target_reps_max: range.max });
            return true;
          }}
          placeholder="reps"
          accessibilityLabel={a11y("Target reps")}
          keyboardType="numbers-and-punctuation"
          style={styles.setField}
        />
      ) : null}

      {usesWeight ? (
        <CommitField
          value={
            set.target_weight_kg === undefined
              ? ""
              : displayNumber(kgToUnit(set.target_weight_kg, units.weight_unit))
          }
          commit={(text) => {
            const value = parseDecimal(text);
            if (value === null) return false;
            const kg = value === undefined ? undefined : unitToKg(value, units.weight_unit);
            if ((kg ?? 0) > 1000) return false;
            onChange({ target_weight_kg: kg });
            return true;
          }}
          placeholder={units.weight_unit}
          accessibilityLabel={a11y(`Target weight in ${units.weight_unit}`)}
          keyboardType="decimal-pad"
          style={styles.setField}
        />
      ) : null}

      {usesDistance ? (
        <CommitField
          value={
            set.target_distance_m === undefined
              ? ""
              : displayNumber(
                  distanceUnit === "m" ? set.target_distance_m : set.target_distance_m / 1609.344,
                )
          }
          commit={(text) => {
            const value = parseDecimal(text);
            if (value === null) return false;
            const metres =
              value === undefined ? undefined : distanceUnit === "m" ? value : value * 1609.344;
            if ((metres ?? 0) > 1_000_000) return false;
            onChange({ target_distance_m: metres });
            return true;
          }}
          placeholder={distanceUnit}
          accessibilityLabel={a11y(
            `Target distance in ${distanceUnit === "m" ? "metres" : "miles"}`,
          )}
          keyboardType="decimal-pad"
          style={styles.setField}
        />
      ) : null}

      {usesDuration ? (
        <CommitField
          value={durationInput(set.target_duration_s)}
          commit={(text) => {
            const seconds = parseDuration(text);
            if (seconds === null || (seconds ?? 0) > 86400) return false;
            onChange({ target_duration_s: seconds });
            return true;
          }}
          placeholder="m:ss"
          accessibilityLabel={a11y("Target time")}
          keyboardType="numbers-and-punctuation"
          style={styles.setField}
        />
      ) : null}

      <IconButton label="−" a11y={a11y("Remove")} onPress={onRemove} disabled={!canRemove} />
    </View>
  );
}

function IconButton({
  label,
  a11y,
  onPress,
  disabled,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[styles.iconButton, { opacity: disabled ? 0.3 : 1 }]}
    >
      <Label size="heading">{label}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 3 },
  name: { fontSize: 20, fontWeight: 600 },
  section: { gap: Spacing.two },
  notes: { minHeight: 70, textAlignVertical: "top" },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  flex: { flex: 1 },
  restRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  restField: { width: 90, paddingVertical: 6 },
  setRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  setType: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  setField: { flex: 1, paddingVertical: 8, textAlign: "center" },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
