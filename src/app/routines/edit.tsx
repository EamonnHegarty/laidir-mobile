import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  usePreventRemove,
  useRouter,
} from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Keyboard } from "react-native";

import { EmptyState, HeaderButton, Screen } from "@/components/ui";
import type { Exercise, RoutineFolder } from "@/data/contract";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import type { Settings } from "@/data/settings";
import { openExercisePicker } from "@/features/exercises/exercise-picker";
import {
  addExercises,
  draftFromRoutine,
  draftToInput,
  emptyDraft,
  type RoutineDraft,
} from "@/features/routines/draft";
import { RoutineEditor } from "@/features/routines/routine-editor";

/** Create a routine (optionally inside `folder`), or edit routine `id`. */
export default function EditRoutineScreen() {
  const { id, folder } = useLocalSearchParams<{ id?: string; folder?: string }>();
  const query = useLiveQuery(
    async (r) => {
      const [routine, folders, custom, settings] = await Promise.all([
        id ? r.routines.get(id) : null,
        r.routines.listFolders(),
        r.exercises.listAll(),
        r.settings.get(),
      ]);
      return { routine, folders, custom: new Map(custom.map((e) => [e.id, e])), settings };
    },
    [id],
  );

  // The draft is taken from the first load only; later changes elsewhere don't overwrite edits.
  const [initial, setInitial] = useState<RoutineDraft>();
  if (!initial && query.data) {
    const { routine } = query.data;
    if (!id) setInitial(emptyDraft(folder));
    else if (routine && routine.deleted_at === null) setInitial(draftFromRoutine(routine));
  }

  if (!query.data) return <Screen />;
  if (!initial) {
    return (
      <Screen>
        <EmptyState title="Routine not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return (
    <Editor
      id={id}
      initial={initial}
      folders={query.data.folders}
      custom={query.data.custom}
      settings={query.data.settings}
    />
  );
}

function Editor({
  id,
  initial,
  folders,
  custom,
  settings,
}: {
  id?: string;
  initial: RoutineDraft;
  folders: readonly RoutineFolder[];
  custom: ReadonlyMap<string, Exercise>;
  settings: Settings;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const repos = useRepositories();
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string>();

  // Save runs after the keyboard closes (so a focused number field commits first), so it reads
  // the newest draft from here rather than from its render-time closure.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const change = (update: (current: RoutineDraft) => RoutineDraft) => {
    setDraft(update);
    setDirty(true);
  };

  usePreventRemove(dirty, ({ data }) => {
    Alert.alert("Discard changes?", "Your changes to this routine haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const leave = (go: () => void) => {
    setDirty(false);
    // Wait for the prevent-remove guard to switch off before navigating away.
    setTimeout(go, 0);
  };

  const save = () => {
    Keyboard.dismiss();
    setTimeout(async () => {
      const { input, problem: missing } = draftToInput(latest.current);
      setProblem(missing);
      if (!input) return;
      try {
        if (id) {
          await repos.routines.update(id, input);
          leave(() => router.back());
        } else {
          const created = await repos.routines.create(input);
          leave(() => router.replace({ pathname: "/routines/[id]", params: { id: created.id } }));
        }
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
    }, 50);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: id ? "Edit routine" : "New routine",
          headerRight: () => <HeaderButton title="Save" onPress={save} />,
        }}
      />
      <RoutineEditor
        draft={draft}
        onChange={(next) => change(() => next)}
        folders={folders}
        customExercises={custom}
        units={settings}
        problem={problem}
        onAddExercises={() =>
          openExercisePicker(
            () => router.push("/routines/pick-exercise"),
            (refs) =>
              change((current) => addExercises(current, refs, settings.default_rest_seconds)),
          )
        }
      />
    </Screen>
  );
}
