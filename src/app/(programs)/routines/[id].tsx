import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { RowGroup } from "@/components/glas";
import {
  Button,
  EmptyState,
  HeaderButton,
  Label,
  Row,
  Screen,
  SectionHeader,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { setSummary } from "@/features/routines/draft";
import { useMoveWorkout } from "@/features/routines/use-move-workout";
import { startSession } from "@/features/workout/start";
import { formatDuration } from "@/lib/units";

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repos = useRepositories();
  const mover = useMoveWorkout();
  const query = useLiveQuery(
    async (r) => {
      const routine = await r.routines.get(id);
      const [folder, custom] = await Promise.all([
        routine?.folder_id
          ? r.routines.listFolders().then((fs) => fs.find((f) => f.id === routine.folder_id))
          : undefined,
        r.exercises.listAll(),
      ]);
      return { routine, folder, custom: new Map(custom.map((e) => [e.id, e])) };
    },
    [id],
  );

  if (!query.data) return <Screen />;
  const { routine, folder, custom } = query.data;
  if (!routine || routine.deleted_at !== null) {
    return (
      <Screen>
        <EmptyState title="Workout not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert(`Delete ${routine.name}?`, "Sessions you logged from it stay in History.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await repos.routines.remove(routine.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: routine.name,
          headerRight: () => (
            <HeaderButton
              title="Edit"
              onPress={() =>
                router.push({ pathname: "/routines/edit", params: { id: routine.id } })
              }
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {routine.notes ? (
          <View style={styles.summary}>
            <Label>{routine.notes}</Label>
          </View>
        ) : null}

        <RowGroup style={[styles.group, styles.programRow]}>
          <Row
            title="Program"
            subtitle={folder ? folder.name : "Not in a program"}
            onPress={() => mover.open(routine)}
            accessibilityLabel={`Program: ${folder ? folder.name : "none"}. Move to another program`}
            right={<Label tone="tint">Move to…</Label>}
          />
        </RowGroup>

        <SectionHeader>Exercises</SectionHeader>
        {routine.exercises.length === 0 ? (
          <EmptyState title="No exercises" message="Tap Edit to add some." />
        ) : (
          <RowGroup style={styles.group}>
            {routine.exercises.map((exercise, index) => {
              const info = describeExercise(exercise.exercise_id, custom.get(exercise.exercise_id));
              const rest =
                exercise.rest_seconds !== undefined
                  ? ` · rest ${formatDuration(exercise.rest_seconds)}`
                  : "";
              return (
                <Row
                  key={`${exercise.exercise_id}-${index}`}
                  title={info.name}
                  subtitle={`${setSummary(exercise)}${rest}`}
                  onPress={
                    info.source === "unknown"
                      ? undefined
                      : () =>
                          router.push({
                            pathname: "/exercise/[ref]",
                            params: { ref: exercise.exercise_id },
                          })
                  }
                />
              );
            })}
          </RowGroup>
        )}

        <View style={styles.actions}>
          <Button
            title="Start workout"
            disabled={routine.exercises.length === 0}
            onPress={() => startSession(repos, () => router.navigate("/active"), routine)}
          />
          <Button title="Delete workout" tone="plain" onPress={confirmDelete} />
        </View>
      </ScrollView>
      {mover.sheet}
      {mover.toast}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.five * 2 },
  summary: { padding: Spacing.three, gap: Spacing.one },
  actions: { padding: Spacing.three, gap: Spacing.two },
  group: { marginHorizontal: Spacing.three },
  programRow: { marginTop: Spacing.two },
});
