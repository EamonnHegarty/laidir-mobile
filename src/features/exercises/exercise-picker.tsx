import { Stack, useRouter } from "expo-router";
import { useState } from "react";

import { HeaderButton, Screen } from "@/components/ui";
import type { ExerciseRef } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";

import { ExerciseBrowser } from "./exercise-browser";
import { exerciseListItems } from "./model";

type PickHandler = (refs: ExerciseRef[]) => void;

// The screen that opened the picker stays mounted underneath it, so a callback is the simplest way
// to hand the picked exercises back. Only one picker is open at a time.
let pending: PickHandler | null = null;

/** Opens a picker route (a screen rendering <ExercisePicker />) and calls onPick with the choice. */
export function openExercisePicker(open: () => void, onPick: PickHandler) {
  pending = onPick;
  open();
}

/** Multi-select exercise picker: tap to tick, then "Add" in the header. */
export function ExercisePicker() {
  const router = useRouter();
  const custom = useLiveQuery((r) => r.exercises.listActive(), []);
  const [selected, setSelected] = useState<ExerciseRef[]>([]);

  const toggle = (ref: ExerciseRef) =>
    setSelected((current) =>
      current.includes(ref) ? current.filter((r) => r !== ref) : [...current, ref],
    );

  const done = () => {
    pending?.(selected);
    pending = null;
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Add exercises",
          headerRight: () => (
            <HeaderButton
              title={selected.length > 0 ? `Add (${selected.length})` : "Add"}
              onPress={done}
              disabled={selected.length === 0}
            />
          ),
        }}
      />
      <ExerciseBrowser
        items={exerciseListItems(custom.data ?? [])}
        selected={new Set(selected)}
        onSelect={(item) => toggle(item.ref)}
      />
    </Screen>
  );
}
