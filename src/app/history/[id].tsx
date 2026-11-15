import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Card, Pill, PillRow, StatTile, StatTiles } from "@/components/glas";
import { Icon } from "@/components/icon";
import { EmptyState, HeaderButton, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { sessionStats, templateFromSession } from "@/features/history/model";
import { formatHours, formatTotalWeight } from "@/features/stats/format";
import { useStats } from "@/features/stats/use-stats";
import { useTheme } from "@/hooks/use-theme";
import { formatSet } from "@/lib/format-set";
import { SET_TYPE_LABELS } from "@/lib/labels";

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

  const stats = useStats();
  const prs = new Set(
    (stats.data?.prs ?? []).filter((p) => p.workout_id === id).map((p) => p.exercise_id),
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
  const summary = sessionStats(workout);

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
          {routine ? (
            <PillRow>
              <Pill
                icon="list_alt"
                label={`From ${routine.name}${routine.deleted_at !== null ? " (deleted)" : ""}`}
              />
            </PillRow>
          ) : null}
          {workout.notes ? <Label>{workout.notes}</Label> : null}
        </View>
        <StatTiles>
          <StatTile
            label="Duration"
            value={
              summary.durationSeconds === undefined ? "–" : formatHours(summary.durationSeconds)
            }
          />
          <StatTile label="Sets" value={String(summary.completedSets)} />
          <StatTile
            label="Volume"
            value={formatTotalWeight(summary.volumeKg, settings.weight_unit)}
          />
        </StatTiles>

        {workout.exercises.map((exercise, index) => {
          const info = describeExercise(exercise.exercise_id, custom.get(exercise.exercise_id));
          let working = 0;
          return (
            <Card key={`${exercise.exercise_id}-${index}`}>
              <View style={styles.exerciseHeader}>
                <Label size="heading" style={styles.flex}>
                  {info.name}
                </Label>
                {prs.has(exercise.exercise_id) ? (
                  <Pill label="PR" icon="trophy" tone="accent" />
                ) : null}
              </View>
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
            </Card>
          );
        })}

        <View style={styles.actions}>
          <ActionRow icon="content_copy" title="Save as a workout" onPress={saveAsTemplate} />
          <ActionRow icon="delete" title="Delete session" danger onPress={confirmDelete} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function ActionRow({
  icon,
  title,
  danger,
  onPress,
}: {
  icon: "content_copy" | "delete";
  title: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = danger ? theme.danger : theme.tint;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={icon} size={20} color={color} />
      <Label style={{ color }}>{title}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five * 2 },
  summary: { gap: Spacing.one },
  exerciseHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three - 4,
  },
  setLine: { flexDirection: "row", gap: Spacing.three },
  setLabel: { width: 72 },
  flex: { flex: 1 },
  actions: { gap: Spacing.two },
});
