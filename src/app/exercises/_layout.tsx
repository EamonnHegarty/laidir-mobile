import { Stack } from "expo-router";

export default function ExercisesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Exercises" }} />
      <Stack.Screen name="[ref]" options={{ title: "" }} />
      <Stack.Screen name="form" options={{ presentation: "modal", title: "New exercise" }} />
    </Stack>
  );
}
