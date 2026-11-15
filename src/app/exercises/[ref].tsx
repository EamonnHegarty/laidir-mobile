import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { LineChart } from "@/components/charts";
import { Card, CardHeader, Pill, PillRow, StatTile, StatTiles } from "@/components/glas";
import { EmptyState, HeaderButton, Label, Screen, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise, isBuiltinRef } from "@/data/catalogue";
import { useLiveQuery } from "@/data/database-provider";
import { exerciseRecords } from "@/features/exercises/records";
import { e1rmSeries, type PrKind } from "@/features/stats/model";
import { useStats } from "@/features/stats/use-stats";
import { formatSet } from "@/lib/format-set";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, SET_TYPE_LABELS, TRACKING_LABELS } from "@/lib/labels";
import { displayNumber, formatWeight, kgToUnit } from "@/lib/units";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

const PR_LABELS: Record<PrKind, string> = { e1rm: "e1RM", weight: "Heaviest", reps: "Reps" };

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
  const stats = useStats();

  if (!query.data) return <Screen />;
  const { custom, history, settings } = query.data;
  const info = describeExercise(ref, custom);
  const records = exerciseRecords(history, info.tracking);
  const editable = info.source === "custom" && !info.retired;
  const unit = settings.weight_unit;

  // PRs per workout for this exercise, and the e1RM trend (all time).
  const prsByWorkout = new Map<string, PrKind[]>();
  for (const pr of stats.data?.prs ?? []) {
    if (pr.exercise_id !== ref) continue;
    prsByWorkout.set(pr.workout_id, [...(prsByWorkout.get(pr.workout_id) ?? []), pr.kind]);
  }
  const points = stats.data ? e1rmSeries(stats.data.sets, ref) : [];
  const e1rmPrs = new Set(
    (stats.data?.prs ?? [])
      .filter((p) => p.exercise_id === ref && p.kind === "e1rm")
      .map((p) => p.workout_id),
  );

  const muscles = [
    info.primary_muscle ? MUSCLE_LABELS[info.primary_muscle] : undefined,
    ...(custom?.secondary_muscles ?? []).map((m) => MUSCLE_LABELS[m]),
  ].filter((m) => m !== undefined) as string[];

  const tiles: { label: string; value: string; accent?: boolean }[] = [];
  if (records.bestOneRepMax) {
    tiles.push({
      label: "Best e1RM",
      value: displayNumber(Math.round(kgToUnit(records.bestOneRepMax.kg, unit) * 10) / 10),
      accent: true,
    });
  }
  if (records.heaviest?.weight_kg !== undefined) {
    tiles.push({
      label: "Heaviest",
      value: `${displayNumber(kgToUnit(records.heaviest.weight_kg, unit))}×${records.heaviest.reps ?? 0}`,
    });
  }
  if (records.mostReps && info.tracking === "reps_only") {
    tiles.push({ label: "Most reps", value: String(records.mostReps.reps), accent: true });
  }
  tiles.push({ label: "Sessions", value: String(records.sessions) });

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
        <PillRow>
          {muscles.map((m, i) => (
            <Pill key={m} label={m} tone={i === 0 ? "accent" : "neutral"} />
          ))}
          {info.equipment ? <Pill label={EQUIPMENT_LABELS[info.equipment]} /> : null}
          <Pill label={TRACKING_LABELS[info.tracking]} />
          {info.source === "custom" ? (
            <Pill label={info.retired ? "Deleted custom exercise" : "Custom"} />
          ) : null}
        </PillRow>
        {custom?.notes ? <Label>{custom.notes}</Label> : null}

        {history.length > 0 ? (
          <StatTiles>
            {tiles.map((t) => (
              <StatTile key={t.label} label={t.label} value={t.value} accent={t.accent} />
            ))}
          </StatTiles>
        ) : null}

        {points.length > 1 ? (
          <Card>
            <CardHeader
              title="Estimated 1RM"
              right={
                <Label tone="secondary" size="small">
                  {unit}
                </Label>
              }
            />
            <LineChart
              values={points.map((p) => kgToUnit(p.kg, unit))}
              marks={points.flatMap((p, i) => (e1rmPrs.has(p.workout_id) ? [i] : []))}
              labels={points.map((p) => shortDate.format(new Date(p.performed_at)))}
              accessibilityLabel={`Estimated one-rep max over ${points.length} sessions, latest ${formatWeight(points.at(-1)!.kg, unit)}`}
            />
          </Card>
        ) : null}

        <SectionHeader>History</SectionHeader>
        {history.length === 0 ? (
          <EmptyState
            title="Not logged yet"
            message="Finished workouts with this exercise show up here."
          />
        ) : (
          history.map((session) => {
            const kinds = prsByWorkout.get(session.workout_id) ?? [];
            return (
              <Card key={session.workout_id}>
                <View style={styles.sessionHeader}>
                  <Label size="small" tone="secondary" style={styles.flex}>
                    {dateFormat.format(new Date(session.performed_at))} · {session.workout_name}
                  </Label>
                  {kinds.length > 0 ? (
                    <Pill
                      icon="trophy"
                      tone="accent"
                      label={kinds.map((k) => PR_LABELS[k]).join(", ")}
                    />
                  ) : null}
                </View>
                {session.sets.map((set) => (
                  <Label
                    key={`${set.exercise_index}-${set.set_index}`}
                    tone={set.completed ? "default" : "secondary"}
                  >
                    {formatSet(set, info.tracking, settings)}
                    {set.set_type === "normal" ? "" : `  ${SET_TYPE_LABELS[set.set_type]}`}
                  </Label>
                ))}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three - 4, paddingBottom: Spacing.five * 2 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  flex: { flex: 1 },
});
