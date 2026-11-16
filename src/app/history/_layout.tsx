import { Stack } from "expo-router";

import { WithWorkoutBanner } from "@/features/workout/workout-banner";

// Keep the tab's first screen underneath anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function HistoryLayout() {
  return (
    <WithWorkoutBanner>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, title: "History" }} />
        <Stack.Screen name="[id]" options={{ title: "" }} />
        <Stack.Screen name="edit" options={{ title: "Edit session" }} />
        <Stack.Screen
          name="pick-exercise"
          options={{ presentation: "modal", title: "Add exercises" }}
        />
      </Stack>
    </WithWorkoutBanner>
  );
}
