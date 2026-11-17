import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
// Gesture Handler's ScrollView coordinates with the swipe-to-delete rows, so a quick flick
// scrolls the page instead of being caught by a row.
import { ScrollView } from "react-native-gesture-handler";

import { ReorderList, setCount } from "@/components/reorder-list";
import { DashedButton, IconAction, Pill } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, WorkoutExercise } from "@/data/contract";
import type { Settings } from "@/data/settings";
import type { LoggedSet } from "@/data/workouts";
import { formatSet } from "@/lib/format-set";
import { tapConfirm } from "@/lib/haptics";
import { useTheme } from "@/hooks/use-theme";

import { ExerciseMenu } from "./exercise-menu";
import { NoteEditor } from "./note-editor";
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
  setNote,
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
  /** Tapping an exercise's name opens its details (history, records, charts). */
  onShowExercise?: (ref: string) => void;
  /** Shown as a Discard button at the bottom when given (the live session). */
  onDiscard?: () => void;
  /** The session's own note (Workout.notes). With `onWorkoutNotes` it can be written or edited. */
  workoutNotes?: string;
  onWorkoutNotes?: (notes: string) => void;
  /** Live session: ticking a set vibrates and starts the rest timer. Off when editing history. */
  live?: boolean;
  header?: React.ReactNode;
};

/**
 * The body of the in-progress workout: name, the Workout's notes, exercises with their sets, add
 * exercises, discard. Tap an exercise's name for its details; long-press it (or use its ⋮ menu) to
 * drag the exercises into a new order. Every exercise stays open.
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
  onShowExercise,
  onDiscard,
  workoutNotes,
  onWorkoutNotes,
  live = true,
  header,
  onReorder,
}: SessionEditorProps & { onReorder: () => void }) {
  const theme = useTheme();
  const [restFor, setRestFor] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  // The exercise whose note is open in the note editor.
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const planNotes = routine?.notes;
  const [editingWorkoutNote, setEditingWorkoutNote] = useState(false);

  const restOf = (exercise: WorkoutExercise, index: number) => {
    const fallback =
      templateFor(routine, exercise, index)?.rest_seconds ?? settings.default_rest_seconds;
    const chosen = exerciseRest?.get(exercise.exercise_id);
    return { seconds: chosen ?? fallback, chosen: chosen !== undefined, fallback };
  };
  const nameOf = (exercise: WorkoutExercise) =>
    describeExercise(exercise.exercise_id, customExercises.get(exercise.exercise_id)).name;

  const editing = restFor === null ? undefined : exercises[restFor];
  const editingRest = editing && restFor !== null ? restOf(editing, restFor) : undefined;
  const menuExercise = menuFor === null ? undefined : exercises[menuFor];
  const noteExercise = noteFor === null ? undefined : exercises[noteFor];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      // Taps on buttons keep the keyboard (kg → reps stays quick); scrolling closes it.
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
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
      {planNotes ? (
        <View style={[styles.notes, { borderLeftColor: theme.tint }]}>
          <Label tone="secondary" size="small">
            {planNotes}
          </Label>
        </View>
      ) : null}
      {onWorkoutNotes ? (
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setEditingWorkoutNote(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            workoutNotes ? `Workout note: ${workoutNotes}. Edit note` : "Add a workout note"
          }
          style={({ pressed }) => [styles.note, pressed && { opacity: 0.6 }]}
        >
          <Icon name="edit_note" size={18} color={theme.tint} />
          <Label tone={workoutNotes ? "secondary" : "tint"} size="small" style={styles.flex}>
            {workoutNotes || "Add a workout note"}
          </Label>
        </Pressable>
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

        return (
          <View
            key={`${exercise.exercise_id}-${index}`}
            style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          >
            <View style={styles.cardHeader}>
              <Pressable
                style={({ pressed }) => [styles.flex, pressed && { opacity: 0.6 }]}
                onPress={
                  onShowExercise
                    ? () => {
                        Keyboard.dismiss();
                        onShowExercise(exercise.exercise_id);
                      }
                    : undefined
                }
                accessibilityRole={onShowExercise ? "button" : "header"}
                onLongPress={exercises.length > 1 ? onReorder : undefined}
                accessibilityHint={onShowExercise ? "Opens history, records and charts" : undefined}
              >
                <Label size="heading" style={{ color: theme.tint }}>
                  {info.name}
                </Label>
              </Pressable>
              {onExerciseRest ? (
                <Pill
                  icon="timer"
                  label={restLabel(rest)}
                  onPress={() => setRestFor(index)}
                  accessibilityLabel={`Rest timer for ${info.name}: ${restLabel(rest)}`}
                />
              ) : null}
              <IconAction
                icon="more_vert"
                label={`More for ${info.name}`}
                size={22}
                onPress={() => {
                  Keyboard.dismiss();
                  setMenuFor(index);
                }}
              />
            </View>

            {exercise.notes ? (
              <Pressable
                onPress={() => setNoteFor(index)}
                accessibilityRole="button"
                accessibilityLabel={`Note: ${exercise.notes}. Edit note`}
                style={({ pressed }) => [styles.note, pressed && { opacity: 0.6 }]}
              >
                <Icon name="sticky_note_2" size={16} color={theme.tint} />
                <Label tone="secondary" size="small" style={styles.flex}>
                  {exercise.notes}
                </Label>
              </Pressable>
            ) : null}

            <LogSetHeader tracking={info.tracking} units={settings} />

            {exercise.sets.map((set, setIndex) => {
              const lastSet = last[setIndex];
              return (
                <LogSetRow
                  key={setIndex}
                  number={setIndex + 1}
                  set={set}
                  tracking={info.tracking}
                  hint={hints[setIndex] ?? {}}
                  previous={lastSet ? formatSet(lastSet, info.tracking, settings) : undefined}
                  units={settings}
                  exerciseName={info.name}
                  onChange={(changes) =>
                    onExercises((cur) =>
                      updateSet(cur, index, setIndex, changes, { fillBelow: live }),
                    )
                  }
                  onRemove={() => onExercises((cur) => removeSet(cur, index, setIndex))}
                  onToggle={() => {
                    // Ticking a set means you're done typing it.
                    Keyboard.dismiss();
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
              <Pressable
                onPress={() => onExercises((cur) => addSet(cur, index))}
                accessibilityRole="button"
                accessibilityLabel={`Add set to ${info.name}`}
                style={({ pressed }) => [styles.addSet, pressed && { opacity: 0.5 }]}
              >
                <Icon name="add" size={18} color={theme.tint} />
                <Label tone="tint" size="small">
                  Add set
                </Label>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {exercises.length < MAX_EXERCISES ? (
        <DashedButton title="Add exercises" onPress={onAddExercises} />
      ) : null}

      {onDiscard ? (
        <Pressable
          onPress={onDiscard}
          accessibilityRole="button"
          style={({ pressed }) => [styles.discard, pressed && { opacity: 0.5 }]}
        >
          <Icon name="delete" size={18} color={theme.danger} />
          <Label tone="danger">Discard workout</Label>
        </Pressable>
      ) : null}

      {editing && editingRest && onExerciseRest ? (
        <RestPicker
          exerciseName={nameOf(editing)}
          current={editingRest.seconds}
          chosen={editingRest.chosen}
          fallback={editingRest.fallback}
          onChoose={(seconds) => onExerciseRest(editing.exercise_id, seconds)}
          onClose={() => setRestFor(null)}
        />
      ) : null}

      {editingWorkoutNote && onWorkoutNotes ? (
        <NoteEditor
          title="Workout note"
          exerciseName={name}
          initial={workoutNotes ?? ""}
          placeholder="How it went, how you felt…"
          onSave={onWorkoutNotes}
          onClose={() => setEditingWorkoutNote(false)}
        />
      ) : null}

      {noteExercise && noteFor !== null ? (
        <NoteEditor
          exerciseName={nameOf(noteExercise)}
          initial={noteExercise.notes ?? ""}
          onSave={(text) => onExercises((cur) => setNote(cur, noteFor, text))}
          onClose={() => setNoteFor(null)}
        />
      ) : null}

      {menuExercise && menuFor !== null ? (
        <ExerciseMenu
          title={nameOf(menuExercise)}
          onClose={() => setMenuFor(null)}
          actions={[
            {
              label: menuExercise.notes ? "Edit note" : "Add note",
              icon: "sticky_note_2",
              onPress: () => setNoteFor(menuFor),
            },
            ...(onShowExercise
              ? [
                  {
                    label: "History and records",
                    icon: "history" as const,
                    onPress: () => onShowExercise(menuExercise.exercise_id),
                  },
                ]
              : []),
            ...(exercises.length > 1
              ? [{ label: "Reorder exercises", icon: "swap_vert" as const, onPress: onReorder }]
              : []),
            {
              label: "Remove exercise",
              icon: "delete",
              danger: true,
              onPress: () => onExercises((cur) => removeExercise(cur, menuFor)),
            },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Room at the bottom so the floating rest timer never covers the last set.
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 6 },
  name: { fontSize: 20, fontWeight: 600 },
  notes: { borderLeftWidth: 3, paddingLeft: Spacing.two, paddingVertical: 2 },
  card: { borderRadius: 12, padding: Spacing.two, gap: 2 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  addSet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  discard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
    paddingVertical: 12,
  },
  flex: { flex: 1 },
});
