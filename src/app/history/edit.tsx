import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  usePreventRemove,
  useRouter,
} from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard } from "react-native";

import { EmptyState, HeaderButton, Label, Screen } from "@/components/ui";
import type { Exercise, Routine, Workout, WorkoutExercise } from "@/data/contract";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import type { Settings } from "@/data/settings";
import { openExercisePicker } from "@/features/exercises/exercise-picker";
import { addExercises, cleanForFinish } from "@/features/workout/session";
import { SessionEditor } from "@/features/workout/session-editor";

type Loaded = {
  workout: Workout;
  routine: Routine | null;
  custom: Map<string, Exercise>;
  settings: Settings;
};

/** Fix a finished session: weights, reps, sets, exercises, name, note. */
export default function EditSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLiveQuery(
    async (r) => {
      const workout = await r.workouts.get(id);
      if (!workout || workout.deleted_at !== null || workout.ended_at === undefined) return null;
      const [routine, custom, settings] = await Promise.all([
        workout.routine_id ? r.routines.get(workout.routine_id) : null,
        r.exercises.listAll(),
        r.settings.get(),
      ]);
      return { workout, routine, custom: new Map(custom.map((e) => [e.id, e])), settings };
    },
    [id],
  );

  // First load only, so saving elsewhere doesn't overwrite edits in progress.
  const [initial, setInitial] = useState<Loaded | null>();
  if (initial === undefined && query.status === "ready") setInitial(query.data);

  if (initial === undefined) return <Screen />;
  if (initial === null) {
    return (
      <Screen>
        <EmptyState title="Session not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return <Editor initial={initial} />;
}

function Editor({ initial }: { initial: Loaded }) {
  const router = useRouter();
  const navigation = useNavigation();
  const repos = useRepositories();
  const { workout, routine, custom, settings } = initial;
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(workout.exercises);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string>();

  const latest = useRef({ name, notes, exercises });
  useEffect(() => {
    latest.current = { name, notes, exercises };
  }, [name, notes, exercises]);

  const changeExercises = (update: (current: WorkoutExercise[]) => WorkoutExercise[]) => {
    setExercises(update);
    setDirty(true);
  };

  usePreventRemove(dirty, ({ data }) => {
    Alert.alert("Discard changes?", "Your edits to this session haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const save = () => {
    Keyboard.dismiss();
    setTimeout(async () => {
      const current = latest.current;
      const cleaned = cleanForFinish(current.exercises);
      if (cleaned.length === 0) {
        setProblem("A session needs at least one set. To remove it, delete the session instead.");
        return;
      }
      try {
        await repos.workouts.save(workout.id, {
          name: current.name.trim() ? current.name : workout.name,
          notes: current.notes,
          exercises: cleaned,
        });
        setDirty(false);
        setTimeout(() => router.back(), 0);
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
    }, 50);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerRight: () => <HeaderButton title="Save" onPress={save} /> }} />
      <SessionEditor
        live={false}
        name={name}
        exercises={exercises}
        onName={(next) => {
          setName(next);
          setDirty(true);
        }}
        onExercises={changeExercises}
        routine={routine}
        customExercises={custom}
        previous={new Map()}
        settings={settings}
        onAddExercises={() =>
          openExercisePicker(
            () => router.push("/history/pick-exercise"),
            (refs) => changeExercises((current) => addExercises(current, refs)),
          )
        }
        header={problem ? <Label tone="danger">{problem}</Label> : undefined}
        workoutNotes={notes}
        onWorkoutNotes={(next) => {
          setNotes(next);
          setDirty(true);
        }}
      />
    </Screen>
  );
}
