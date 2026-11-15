import { Stack } from "expo-router";

export default function WorkoutLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Workout" }} />
      <Stack.Screen name="active" options={{ title: "" }} />
      <Stack.Screen
        name="pick-exercise"
        options={{ presentation: "modal", title: "Add exercises" }}
      />
    </Stack>
  );
}
