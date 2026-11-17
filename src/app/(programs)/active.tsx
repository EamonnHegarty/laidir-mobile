import { useScreenAwake } from "@/lib/keep-awake";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Keyboard, StyleSheet, View } from "react-native";

import { Button, EmptyState, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { Exercise, ExerciseRef, Routine, Workout, WorkoutExercise } from "@/data/contract";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import type { Settings } from "@/data/settings";
import type { LoggedSet } from "@/data/workouts";
import { openExercisePicker } from "@/features/exercises/exercise-picker";
import { restTimer } from "@/features/workout/rest-timer";
import { addExercises, cleanForFinish, summarise, withNotes } from "@/features/workout/session";
import { SessionEditor } from "@/features/workout/session-editor";
import { ElapsedTime, FinishButton, RestOverlay } from "@/features/workout/timers";

type Loaded = {
  workout: Workout;
  routine: Routine | null;
  custom: Map<string, Exercise>;
  settings: Settings;
  previous: Map<ExerciseRef, LoggedSet[]>;
  exerciseRest: Map<string, number>;
};

/** The workout in progress. Every change is saved as you go, so it survives the app closing. */
export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>();
  const query = useLiveQuery(async (r) => {
    const workout = await r.workouts.getActive();
    if (!workout) return null;
    const [routine, custom, settings, previous, exerciseRest] = await Promise.all([
      workout.routine_id ? r.routines.get(workout.routine_id) : null,
      r.exercises.listAll(),
      r.settings.get(),
      previousFor(
        r,
        workout.exercises.map((e) => e.exercise_id),
      ),
      r.settings.exerciseRest(),
    ]);
    return {
      workout,
      routine,
      custom: new Map(custom.map((e) => [e.id, e])),
      settings,
      previous,
      exerciseRest,
    };
  }, []);

  // Take the first load only: after that this screen owns the session and saves it, and reloading
  // on every save would fight the user's typing.
  if (loaded === undefined && query.status === "ready") setLoaded(query.data);

  if (loaded === undefined) return <Screen />;
  if (loaded === null) {
    return (
      <Screen>
        <EmptyState title="No workout in progress" message="Start one from Programs." />
        <View style={styles.pad}>
          <Button title="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }
  return <ActiveSession initial={loaded} />;
}

function previousFor(
  r: ReturnType<typeof useRepositories>,
  refs: readonly ExerciseRef[],
): Promise<Map<ExerciseRef, LoggedSet[]>> {
  const unique = [...new Set(refs)];
  return Promise.all(unique.map((ref) => r.workouts.lastPerformance(ref))).then(
    (results) => new Map(unique.map((ref, i) => [ref, results[i]!])),
  );
}

const SAVE_DELAY_MS = 400;

function ActiveSession({ initial }: { initial: Loaded }) {
  // The phone shouldn't sleep between sets.
  useScreenAwake("active-workout");
  const router = useRouter();
  const repos = useRepositories();
  const { workout, routine, custom, settings } = initial;
  const [name, setName] = useState(workout.name);
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [exercises, setExercises] = useState<WorkoutExercise[]>(workout.exercises);
  const [previous, setPrevious] = useState(initial.previous);
  const [exerciseRest, setExerciseRest] = useState(initial.exerciseRest);

  const chooseRest = (ref: string, seconds: number | null) => {
    setExerciseRest((current) => {
      const next = new Map(current);
      if (seconds === null) next.delete(ref);
      else next.set(ref, seconds);
      return next;
    });
    void repos.settings.setExerciseRest(ref, seconds);
  };

  // Save shortly after each change; finish/discard flush or cancel it.
  const content = { name: name.trim() ? name : workout.name, notes, exercises };
  const latest = useRef(content);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    latest.current = { name: name.trim() ? name : workout.name, notes, exercises };
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      void repos.workouts.save(workout.id, latest.current);
    }, SAVE_DELAY_MS);
  }, [name, notes, exercises, repos, workout.id, workout.name]);

  // Leaving the screen (back to the tab) saves straight away.
  useEffect(
    () => () => {
      if (pending.current) {
        clearTimeout(pending.current);
        void repos.workouts.save(workout.id, latest.current);
      }
    },
    [repos, workout.id],
  );

  // The app leaving the screen (home, lock, switching app) saves straight away too, so nothing is
  // lost if Android then closes it.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" && pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
        void repos.workouts.save(workout.id, latest.current);
      }
    });
    return () => sub.remove();
  }, [repos, workout.id]);

  const cancelPendingSave = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  };

  const finish = () => {
    Keyboard.dismiss();
    const summary = summarise(latest.current.exercises);
    if (summary.completedSets === 0) {
      Alert.alert(
        "No sets done yet",
        "Tick off at least one set to finish, or discard the workout.",
        [{ text: "OK" }],
      );
      return;
    }
    const done = async () => {
      cancelPendingSave();
      const final = { ...latest.current, exercises: cleanForFinish(latest.current.exercises) };
      await repos.workouts.save(workout.id, final);
      await repos.workouts.finish(workout.id);
      restTimer.stop();
      router.dismissAll();
    };
    const left = summary.unfinishedSets;
    if (left > 0) {
      Alert.alert(
        `${left} ${left === 1 ? "set" : "sets"} not completed`,
        "Finish anyway to end the workout without them, or go back to complete or edit them.",
        [
          { text: "Go back", style: "cancel" },
          { text: "Finish anyway", onPress: () => void done() },
        ],
      );
      return;
    }
    Alert.alert("Finish workout?", `${summary.completedSets} sets done.`, [
      { text: "Keep going", style: "cancel" },
      { text: "Finish", onPress: () => void done() },
    ]);
  };

  const discard = () =>
    Alert.alert("Discard workout?", "Everything logged in this session is thrown away.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          cancelPendingSave();
          await repos.workouts.remove(workout.id);
          restTimer.stop();
          router.dismissAll();
        },
      },
    ]);

  const addFromPicker = () =>
    openExercisePicker(
      () => router.push("/pick-exercise"),
      async (refs) => {
        let from = 0;
        setExercises((current) => {
          from = current.length;
          return addExercises(current, refs);
        });
        // Notes from last time ("seat on 4") for the exercises just added.
        const notes = await repos.workouts.lastNotes(refs);
        if (notes.size > 0) setExercises((current) => withNotes(current, notes, from));
        const missing = refs.filter((ref) => !previous.has(ref));
        if (missing.length > 0) {
          const found = await previousFor(repos, missing);
          setPrevious((current) => new Map([...current, ...found]));
        }
      },
    );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "",
          headerLeft: () => <ElapsedTime startedAt={workout.started_at} />,
          headerRight: () => <FinishButton onPress={finish} />,
        }}
      />
      <SessionEditor
        name={name}
        exercises={exercises}
        onName={setName}
        onExercises={setExercises}
        routine={routine}
        customExercises={custom}
        previous={previous}
        settings={settings}
        exerciseRest={exerciseRest}
        onExerciseRest={chooseRest}
        onAddExercises={addFromPicker}
        onShowExercise={(ref) => router.push({ pathname: "/exercise-history", params: { ref } })}
        onDiscard={discard}
        workoutNotes={notes}
        onWorkoutNotes={setNotes}
      />
      <RestOverlay />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: Spacing.three },
});
