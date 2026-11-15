import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ReorderList, setCount } from "@/components/reorder-list";
import { Button, Field, IconButton, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, WorkoutExercise } from "@/data/contract";
import type { Settings } from "@/data/settings";
import type { LoggedSet } from "@/data/workouts";
import { formatSet } from "@/lib/format-set";
import { tapConfirm } from "@/lib/haptics";
import { useTheme } from "@/hooks/use-theme";

import { RestPicker, restLabel } from "./rest-picker";
import { restTimer } from "./rest-timer";
import {
  addSet,
  MAX_EXERCISES,
  MAX_SETS,
  moveExercise,
  removeExercise,
  removeSet,
  setHints,
  templateFor,
  toggleComplete,
  updateSet,
} from "./session";
import { LogSetHeader, LogSetRow } from "./set-row";

export type SessionEditorProps = {
  name: string;
  exercises: WorkoutExercise[];
  onName: (name: string) => void;
  onExercises: (update: (current: WorkoutExercise[]) => WorkoutExercise[]) => void;
  /** The workout template it was started from, for rest times, target hints and its notes. */
  routine: Routine | null;
  customExercises: ReadonlyMap<string, Exercise>;
  /** Last finished session's sets per exercise ref. */
  previous: ReadonlyMap<string, LoggedSet[]>;
  settings: Settings;
  /** Rest chosen per exercise ref. With `onExerciseRest`, each card shows a rest timer button. */
  exerciseRest?: ReadonlyMap<string, number>;
  onExerciseRest?: (ref: string, seconds: number | null) => void;
  onAddExercises: () => void;
  /** Shown as a Discard button at the bottom when given (the live session). */
  onDiscard?: () => void;
  /** Live session: ticking a set vibrates and starts the rest timer. Off when editing history. */
  live?: boolean;
  header?: React.ReactNode;
};

/**
 * The body of the in-progress workout: name, the Workout's notes, exercises with their sets, add
 * exercises, discard. Long-press an exercise name to drag the exercises into a new order.
 */
export function SessionEditor(props: SessionEditorProps) {
  const [reordering, setReordering] = useState(false);
  if (reordering) {
    return (
      <ReorderList
        items={props.exercises.map((exercise, index) => ({
          key: `${exercise.exercise_id}-${index}`,
          name: describeExercise(
            exercise.exercise_id,
            props.customExercises.get(exercise.exercise_id),
          ).name,
          detail: setCount(exercise.sets.length),
        }))}
        onMove={(from, to) => props.onExercises((cur) => moveExercise(cur, from, to))}
        onDone={() => setReordering(false)}
      />
    );
  }
  return <SessionBody {...props} onReorder={() => setReordering(true)} />;
}

function SessionBody({
  name,
  exercises,
  onName,
  onExercises,
  routine,
  customExercises,
  previous,
  settings,
  exerciseRest,
  onExerciseRest,
  onAddExercises,
  onDiscard,
  live = true,
  header,
  onReorder,
}: SessionEditorProps & { onReorder: () => void }) {
  const theme = useTheme();
  const [restFor, setRestFor] = useState<number | null>(null);
  const notes = routine?.notes;

  const restOf = (exercise: WorkoutExercise, index: number) => {
    const fallback =
      templateFor(routine, exercise, index)?.rest_seconds ?? settings.default_rest_seconds;
    const chosen = exerciseRest?.get(exercise.exercise_id);
    return { seconds: chosen ?? fallback, chosen: chosen !== undefined, fallback };
  };

  const editing = restFor === null ? undefined : exercises[restFor];
  const editingRest = editing && restFor !== null ? restOf(editing, restFor) : undefined;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {header}
      <Field
        value={name}
        onChangeText={onName}
        accessibilityLabel="Session name"
        maxLength={100}
        style={styles.name}
      />
      {notes ? (
        <View style={[styles.notes, { borderLeftColor: theme.tint }]}>
          <Label tone="secondary" size="small">
            {notes}
          </Label>
        </View>
      ) : null}

      {exercises.map((exercise, index) => {
        const info = describeExercise(
          exercise.exercise_id,
          customExercises.get(exercise.exercise_id),
        );
        const template = templateFor(routine, exercise, index);
        const last = previous.get(exercise.exercise_id) ?? [];
        const hints = setHints(exercise.sets, last, template);
        const rest = restOf(exercise, index).seconds;
        let working = 0;

        return (
          <View
            key={`${exercise.exercise_id}-${index}`}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.cardHeader}>
              <Pressable
                style={styles.flex}
                onLongPress={exercises.length > 1 ? onReorder : undefined}
                accessibilityHint={
                  exercises.length > 1 ? "Long-press to reorder exercises" : undefined
                }
              >
                <Label size="heading" style={{ color: theme.tint }}>
                  {info.name}
                </Label>
              </Pressable>
              {onExerciseRest ? (
                <Pressable
                  onPress={() => setRestFor(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rest timer for ${info.name}: ${restLabel(rest)}`}
                  hitSlop={6}
                  style={[styles.restChip, { backgroundColor: theme.background }]}
                >
                  <Label size="small" tone={rest === 0 ? "secondary" : "default"}>
                    ⏱ {restLabel(rest)}
                  </Label>
                </Pressable>
              ) : null}
              <IconButton
                icon="close"
                a11y={`Remove ${info.name}`}
                onPress={() => onExercises((cur) => removeExercise(cur, index))}
              />
            </View>

            <LogSetHeader tracking={info.tracking} units={settings} />

            {exercise.sets.map((set, setIndex) => {
              if (set.set_type !== "warmup") working++;
              const lastSet = last[setIndex];
              return (
                <LogSetRow
                  key={setIndex}
                  number={working}
                  set={set}
                  tracking={info.tracking}
                  hint={hints[setIndex] ?? {}}
                  previous={lastSet ? formatSet(lastSet, info.tracking, settings) : undefined}
                  units={settings}
                  exerciseName={info.name}
                  onChange={(changes) =>
                    onExercises((cur) => updateSet(cur, index, setIndex, changes))
                  }
                  onRemove={() => onExercises((cur) => removeSet(cur, index, setIndex))}
                  onToggle={() => {
                    const completing = !set.completed;
                    onExercises((cur) =>
                      toggleComplete(cur, index, setIndex, hints[setIndex], info.tracking),
                    );
                    if (completing && live) {
                      tapConfirm();
                      restTimer.start(rest);
                    }
                  }}
                />
              );
            })}
            {exercise.sets.length < MAX_SETS ? (
              <Button
                title="Add set"
                tone="plain"
                onPress={() => onExercises((cur) => addSet(cur, index))}
              />
            ) : null}
          </View>
        );
      })}

      {exercises.length < MAX_EXERCISES ? (
        <Button title="Add exercises" onPress={onAddExercises} />
      ) : null}

      {onDiscard ? <Button title="Discard workout" tone="danger" onPress={onDiscard} /> : null}

      {editing && editingRest && onExerciseRest ? (
        <RestPicker
          exerciseName={
            describeExercise(editing.exercise_id, customExercises.get(editing.exercise_id)).name
          }
          current={editingRest.seconds}
          chosen={editingRest.chosen}
          fallback={editingRest.fallback}
          onChoose={(seconds) => onExerciseRest(editing.exercise_id, seconds)}
          onClose={() => setRestFor(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 3 },
  name: { fontSize: 20, fontWeight: 600 },
  notes: { borderLeftWidth: 3, paddingLeft: Spacing.two, paddingVertical: 2 },
  card: { borderRadius: 12, padding: Spacing.two, gap: Spacing.one },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  restChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  flex: { flex: 1 },
});
