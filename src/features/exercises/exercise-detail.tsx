import { Stack } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { BarChart, LineChart } from "@/components/charts";
import {
  Card,
  CardHeader,
  IconAction,
  Pill,
  PillRow,
  StatTile,
  StatTiles,
} from "@/components/glas";
import { EmptyState, HeaderButton, Label, Screen, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise, type ExerciseInfo, isBuiltinRef } from "@/data/catalogue";
import type { Tracking } from "@/data/contract";
import type { ExerciseSession, LoggedSet } from "@/data/workouts";
import { useLiveQuery } from "@/data/database-provider";
import { exerciseRecords } from "@/features/exercises/records";
import { e1rmSeries, isWorking, type PrKind, setVolume } from "@/features/stats/model";
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

/**
 * An exercise's page: muscles and equipment, records, the e1RM trend and recent sessions with PR
 * badges. Every tab that links to an exercise renders this in its own stack, so Back returns to
 * where you came from. `onEdit` shows Edit for a live custom exercise.
 */
export function ExerciseDetail({
  exerciseRef: ref,
  onEdit,
  onClose,
}: {
  exerciseRef: string;
  onEdit?: () => void;
  /** Shown as a close button (✕) when the page is opened as a sheet over a workout. */
  onClose?: () => void;
}) {
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
  const editable = onEdit !== undefined && info.source === "custom" && !info.retired;
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
    ...info.secondary_muscles.map((m) => MUSCLE_LABELS[m]),
  ].filter((m) => m !== undefined) as string[];

  // Oldest first, for the charts.
  const sessionsOldest = [...history].reverse();
  const volumes = sessionsOldest.map((session) =>
    session.sets.reduce((sum, set) => sum + setVolume(set, info.tracking), 0),
  );
  const showVolume = volumes.filter((v) => v > 0).length > 1;
  const best = bestSets(history, info.tracking);

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
          headerRight: editable ? () => <HeaderButton title="Edit" onPress={onEdit} /> : undefined,
          headerLeft: onClose
            ? () => <IconAction icon="close" label="Close" onPress={onClose} />
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
        <Label tone="secondary">{describe(info)}</Label>
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

        {showVolume ? (
          <Card>
            <CardHeader
              title="Volume per session"
              right={
                <Label tone="secondary" size="small">
                  {unit}
                </Label>
              }
            />
            <BarChart
              values={volumes.map((kg) => kgToUnit(kg, unit))}
              labels={sessionsOldest.map((s) => shortDate.format(new Date(s.performed_at)))}
              accessibilityLabel={`Volume over ${volumes.length} sessions, latest ${formatWeight(volumes.at(-1) ?? 0, unit)}`}
            />
          </Card>
        ) : null}

        {best.length > 0 ? (
          <Card>
            <CardHeader title="Best sets" />
            {best.map((set, i) => (
              <View
                key={`${set.workout_id}-${set.exercise_index}-${set.set_index}`}
                style={styles.bestRow}
              >
                <Label tone={i === 0 ? "tint" : "default"} style={styles.flex}>
                  {formatSet(set, info.tracking, settings)}
                </Label>
                <Label tone="secondary" size="small">
                  {shortDate.format(new Date(set.performed_at))}
                </Label>
              </View>
            ))}
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

/** "Barbell exercise for chest, also working triceps and shoulders. Logged as weight and reps." */
export function describe(info: ExerciseInfo): string {
  const lower = (s: string) => s.toLowerCase();
  const list = (items: string[]) =>
    items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  const kind = info.equipment ? `${EQUIPMENT_LABELS[info.equipment]} exercise` : "Exercise";
  const target = info.primary_muscle ? ` for ${lower(MUSCLE_LABELS[info.primary_muscle])}` : "";
  const also =
    info.secondary_muscles.length > 0
      ? `, also working ${list(info.secondary_muscles.map((m) => lower(MUSCLE_LABELS[m])))}`
      : "";
  return `${kind}${target}${also}. Logged as ${lower(TRACKING_LABELS[info.tracking])}.`;
}

/** Up to three best working sets: by estimated 1RM when weighted, otherwise most reps or longest. */
function bestSets(history: readonly ExerciseSession[], tracking: Tracking): LoggedSet[] {
  const score = (set: LoggedSet): number => {
    if (set.weight_kg !== undefined && set.reps !== undefined && tracking !== "assisted_bodyweight")
      return set.weight_kg * (1 + set.reps / 30);
    return set.reps ?? set.duration_s ?? set.distance_m ?? 0;
  };
  return history
    .flatMap((s) => s.sets)
    .filter((set) => isWorking(set) && score(set) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three - 4, paddingBottom: Spacing.five * 2 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  bestRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingVertical: 2 },
  flex: { flex: 1 },
});
