import { Stack } from "expo-router";

// Keep the tab's first screen underneath anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function ExercisesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, title: "Exercises" }} />
      <Stack.Screen name="[ref]" options={{ title: "" }} />
      <Stack.Screen name="form" options={{ presentation: "modal", title: "New exercise" }} />
    </Stack>
  );
}
