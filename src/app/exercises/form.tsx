import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";

import { EmptyState, Screen } from "@/components/ui";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { ExerciseForm } from "@/features/exercises/exercise-form";

/** New custom exercise, or edit one when `id` is given. */
export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const repos = useRepositories();
  const existing = useLiveQuery(async (r) => (id ? r.exercises.get(id) : null), [id]);

  if (id && existing.status === "loading") return <Screen />;
  const exercise = existing.data;
  if (id && (!exercise || exercise.deleted_at !== null)) {
    return (
      <Screen>
        <EmptyState title="Exercise not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const confirmDelete = (exerciseId: string, name: string) =>
    Alert.alert(
      `Delete ${name}?`,
      "It disappears from the exercise list. Workouts that used it keep it in their history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await repos.exercises.remove(exerciseId);
            router.dismissTo("/exercises");
          },
        },
      ],
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise ? "Edit exercise" : "New exercise" }} />
      <ExerciseForm
        initial={exercise ?? undefined}
        submitLabel={exercise ? "Save" : "Create exercise"}
        onSubmit={async (input) => {
          if (exercise) {
            await repos.exercises.update(exercise.id, input);
            router.back();
          } else {
            const created = await repos.exercises.create(input);
            router.replace({ pathname: "/exercises/[ref]", params: { ref: created.id } });
          }
        }}
        onDelete={exercise ? () => confirmDelete(exercise.id, exercise.name) : undefined}
      />
    </Screen>
  );
}
