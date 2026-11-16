import { Stack } from "expo-router";

import { WithWorkoutBanner } from "@/features/workout/workout-banner";

// Keep the tab's first screen underneath anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function ExercisesLayout() {
  return (
    <WithWorkoutBanner>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, title: "Exercises" }} />
        <Stack.Screen name="[ref]" options={{ title: "" }} />
        <Stack.Screen name="form" options={{ presentation: "modal", title: "New exercise" }} />
      </Stack>
    </WithWorkoutBanner>
  );
}
