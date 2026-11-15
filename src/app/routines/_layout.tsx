import { Stack } from "expo-router";

// Keep the tab's first screen underneath anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function RoutinesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Programs" }} />
      <Stack.Screen name="[id]" options={{ title: "" }} />
      <Stack.Screen name="edit" options={{ title: "Workout" }} />
      <Stack.Screen
        name="pick-exercise"
        options={{ presentation: "modal", title: "Add exercises" }}
      />
      <Stack.Screen name="folder" options={{ presentation: "modal", title: "Program" }} />
    </Stack>
  );
}
