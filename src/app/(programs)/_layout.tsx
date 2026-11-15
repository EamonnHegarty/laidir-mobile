import { Stack } from "expo-router";

// Programs is the home tab ("/"): start or resume training here. Keep its first screen underneath
// anything pushed or opened as a modal.
export const unstable_settings = { anchor: "index" };

export default function ProgramsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, title: "Programs" }} />
      <Stack.Screen name="active" options={{ title: "" }} />
      <Stack.Screen
        name="pick-exercise"
        options={{ presentation: "modal", title: "Add exercises" }}
      />
      <Stack.Screen name="routines/[id]" options={{ title: "" }} />
      <Stack.Screen name="routines/edit" options={{ title: "Workout" }} />
      <Stack.Screen
        name="routines/pick-exercise"
        options={{ presentation: "modal", title: "Add exercises" }}
      />
      <Stack.Screen name="routines/folder" options={{ presentation: "modal", title: "Program" }} />
    </Stack>
  );
}
