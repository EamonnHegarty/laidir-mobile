import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { EmptyState, HeaderButton, Label, Row, Screen, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise, isBuiltinRef } from "@/data/catalogue";
import { useLiveQuery } from "@/data/database-provider";
import { exerciseRecords } from "@/features/exercises/records";
import { formatSet } from "@/lib/format-set";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, SET_TYPE_LABELS, TRACKING_LABELS } from "@/lib/labels";
import { formatWeight } from "@/lib/units";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function ExerciseDetailScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const query = useLiveQuery(
    async (r) => {
      const custom = isBuiltinRef(ref) ? null : await r.exercises.get(ref);
      const [history, settings] = await Promise.all([
        r.workouts.exerciseHistory(ref, { limit: 30 }),
        r.settings.get(),
      ]);
      return { custom, history, settings };
    },
    [ref],
  );

  if (!query.data) return <Screen />;
  const { custom, history, settings } = query.data;
  const info = describeExercise(ref, custom);
  const records = exerciseRecords(history, info.tracking);
  const editable = info.source === "custom" && !info.retired;
  const muscles = [
    info.primary_muscle ? MUSCLE_LABELS[info.primary_muscle] : undefined,
    ...(custom?.secondary_muscles ?? []).map((m) => MUSCLE_LABELS[m]),
  ].filter(Boolean);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: info.name,
          headerRight: editable
            ? () => (
                <HeaderButton
                  title="Edit"
                  onPress={() => router.push({ pathname: "/exercises/form", params: { id: ref } })}
                />
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <Label tone="secondary">
            {[
              info.equipment ? EQUIPMENT_LABELS[info.equipment] : undefined,
              muscles.join(", "),
              TRACKING_LABELS[info.tracking],
            ]
              .filter(Boolean)
              .join(" · ")}
          </Label>
          {info.source === "custom" ? (
            <Label tone="secondary" size="small">
              {info.retired ? "Deleted custom exercise" : "Custom exercise"}
            </Label>
          ) : null}
          {custom?.notes ? <Label>{custom.notes}</Label> : null}
        </View>

        {records.heaviest || records.mostReps ? <SectionHeader>Records</SectionHeader> : null}
        {records.heaviest ? (
          <Row
            title="Heaviest weight"
            right={<Label>{formatSet(records.heaviest, info.tracking, settings)}</Label>}
          />
        ) : null}
        {records.bestOneRepMax ? (
          <Row
            title="Best estimated 1RM"
            right={<Label>{formatWeight(records.bestOneRepMax.kg, settings.weight_unit)}</Label>}
          />
        ) : null}
        {records.mostReps && info.tracking === "reps_only" ? (
          <Row title="Most reps" right={<Label>{records.mostReps.reps}</Label>} />
        ) : null}

        <SectionHeader>History</SectionHeader>
        {history.length === 0 ? (
          <EmptyState
            title="Not logged yet"
            message="Finished workouts with this exercise show up here."
          />
        ) : (
          history.map((session) => (
            <View key={session.workout_id} style={styles.session}>
              <Label size="small" tone="secondary">
                {dateFormat.format(new Date(session.performed_at))} · {session.workout_name}
              </Label>
              {session.sets.map((set) => (
                <Label
                  key={`${set.exercise_index}-${set.set_index}`}
                  tone={set.completed ? "default" : "secondary"}
                >
                  {formatSet(set, info.tracking, settings)}
                  {set.set_type === "normal" ? "" : `  ${SET_TYPE_LABELS[set.set_type]}`}
                </Label>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.five * 2 },
  summary: { padding: Spacing.three, gap: Spacing.one },
  session: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: 2 },
});
