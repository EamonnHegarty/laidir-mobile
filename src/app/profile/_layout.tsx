import { Stack } from "expo-router";

import { WithWorkoutBanner } from "@/features/workout/workout-banner";

// Keep the tab's first screen underneath anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function ProfileLayout() {
  return (
    <WithWorkoutBanner>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false, title: "Profile" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="claude" options={{ title: "Connect Claude" }} />
        <Stack.Screen name="exercise/[ref]" options={{ title: "" }} />
        <Stack.Screen
          name="pick-exercise"
          options={{ presentation: "modal", title: "Choose an exercise" }}
        />
      </Stack>
    </WithWorkoutBanner>
  );
}
