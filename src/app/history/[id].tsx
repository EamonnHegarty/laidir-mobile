import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import { Button, EmptyState, HeaderButton, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { sessionStats, templateFromSession } from "@/features/history/model";
import { useTheme } from "@/hooks/use-theme";
import { formatSet } from "@/lib/format-set";
import { SET_TYPE_LABELS } from "@/lib/labels";
import { formatDuration, formatWeight } from "@/lib/units";

const when = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const repos = useRepositories();
  const theme = useTheme();
  const query = useLiveQuery(
    async (r) => {
      const [workout, custom, settings] = await Promise.all([
        r.workouts.get(id),
        r.exercises.listAll(),
        r.settings.get(),
      ]);
      const routine = workout?.routine_id ? await r.routines.get(workout.routine_id) : null;
      return { workout, routine, custom: new Map(custom.map((e) => [e.id, e])), settings };
    },
    [id],
  );

  if (!query.data) return <Screen />;
  const { workout, routine, custom, settings } = query.data;
  if (!workout || workout.deleted_at !== null || workout.ended_at === undefined) {
    return (
      <Screen>
        <EmptyState title="Session not found" message="It may have been deleted." />
      </Screen>
    );
  }
  const stats = sessionStats(workout);

  const confirmDelete = () =>
    Alert.alert("Delete this session?", "It's removed from History and exercise records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await repos.workouts.remove(workout.id);
          router.back();
        },
      },
    ]);

  const saveAsTemplate = async () => {
    const created = await repos.routines.create(templateFromSession(workout));
    Alert.alert(
      "Saved as a workout",
      `"${created.name}" is in Programs under Other workouts, with today's weights and reps as targets.`,
    );
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: workout.name,
          headerRight: () => (
            <HeaderButton
              title="Edit"
              onPress={() => router.push({ pathname: "/history/edit", params: { id: workout.id } })}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Label tone="secondary">{when.format(new Date(workout.started_at))}</Label>
          <Label>
            {[
              stats.durationSeconds === undefined
                ? undefined
                : formatDuration(stats.durationSeconds),
              `${stats.completedSets} sets`,
              stats.volumeKg > 0
                ? `${formatWeight(stats.volumeKg, settings.weight_unit)} lifted`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Label>
          {routine ? (
            <Label tone="secondary" size="small">
              From {routine.name}
              {routine.deleted_at !== null ? " (deleted)" : ""}
            </Label>
          ) : null}
          {workout.notes ? <Label>{workout.notes}</Label> : null}
        </View>

        {workout.exercises.map((exercise, index) => {
          const info = describeExercise(exercise.exercise_id, custom.get(exercise.exercise_id));
          let working = 0;
          return (
            <View
              key={`${exercise.exercise_id}-${index}`}
              style={[styles.card, { backgroundColor: theme.backgroundElement }]}
            >
              <Label size="heading">{info.name}</Label>
              {exercise.sets.map((set, setIndex) => {
                if (set.set_type !== "warmup") working++;
                const label =
                  set.set_type === "normal" ? String(working) : SET_TYPE_LABELS[set.set_type];
                return (
                  <View key={setIndex} style={styles.setLine}>
                    <Label tone="secondary" style={styles.setLabel}>
                      {label}
                    </Label>
                    <Label tone={set.completed ? "default" : "secondary"} style={styles.flex}>
                      {formatSet(set, info.tracking, settings)}
                      {set.completed ? "" : "  (not done)"}
                    </Label>
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={styles.actions}>
          <Button title="Save as a workout" tone="plain" onPress={saveAsTemplate} />
          <Button title="Delete session" tone="danger" onPress={confirmDelete} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 2 },
  summary: { gap: Spacing.one },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  setLine: { flexDirection: "row", gap: Spacing.three },
  setLabel: { width: 72 },
  flex: { flex: 1 },
  actions: { gap: Spacing.two },
});
