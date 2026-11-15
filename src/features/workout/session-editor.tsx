import { ScrollView, StyleSheet, View } from "react-native";

import { Button, Field, IconButton, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, WorkoutExercise } from "@/data/contract";
import type { Settings } from "@/data/settings";
import type { LoggedSet } from "@/data/workouts";
import { formatSet } from "@/lib/format-set";
import { tapConfirm } from "@/lib/haptics";
import { useTheme } from "@/hooks/use-theme";

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
  /** The workout template it was started from, for rest times and target hints. */
  routine: Routine | null;
  customExercises: ReadonlyMap<string, Exercise>;
  /** Last finished session's sets per exercise ref. */
  previous: ReadonlyMap<string, LoggedSet[]>;
  settings: Settings;
  onAddExercises: () => void;
  /** Shown as a Discard button at the bottom when given (the live session). */
  onDiscard?: () => void;
  /** Live session: ticking a set vibrates and starts the rest timer. Off when editing history. */
  live?: boolean;
  header?: React.ReactNode;
};

/** The body of the in-progress workout: name, exercises with their sets, add exercises, discard. */
export function SessionEditor({
  name,
  exercises,
  onName,
  onExercises,
  routine,
  customExercises,
  previous,
  settings,
  onAddExercises,
  onDiscard,
  live = true,
  header,
}: SessionEditorProps) {
  const theme = useTheme();

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

      {exercises.map((exercise, index) => {
        const info = describeExercise(
          exercise.exercise_id,
          customExercises.get(exercise.exercise_id),
        );
        const template = templateFor(routine, exercise, index);
        const last = previous.get(exercise.exercise_id) ?? [];
        const hints = setHints(exercise.sets, last, template);
        const rest = template?.rest_seconds ?? settings.default_rest_seconds;
        let working = 0;

        return (
          <View
            key={`${exercise.exercise_id}-${index}`}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.cardHeader}>
              <Label size="heading" style={styles.flex}>
                {info.name}
              </Label>
              <IconButton
                label="↑"
                a11y={`Move ${info.name} up`}
                disabled={index === 0}
                onPress={() => onExercises((cur) => moveExercise(cur, index, -1))}
              />
              <IconButton
                label="↓"
                a11y={`Move ${info.name} down`}
                disabled={index === exercises.length - 1}
                onPress={() => onExercises((cur) => moveExercise(cur, index, 1))}
              />
              <IconButton
                label="✕"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 3 },
  name: { fontSize: 20, fontWeight: 600 },
  card: { borderRadius: 12, padding: Spacing.two, gap: Spacing.one },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingLeft: Spacing.one,
  },
  flex: { flex: 1 },
});
