import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { BarChart, HBarList, LineChart } from "@/components/charts";
import {
  Card,
  CardHeader,
  IconAction,
  PageHeader,
  Pill,
  Segmented,
  StatTile,
  StatTiles,
} from "@/components/glas";
import { Label, Row, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { ExerciseRef } from "@/data/contract";
import {
  bucketLabel,
  formatHours,
  formatTotalWeight,
  percentChange,
} from "@/features/stats/format";
import {
  bucketSizeFor,
  bucketStarts,
  e1rmSeries,
  mostLoggedWeighted,
  MUSCLE_GROUP_LABELS,
  muscleBalance,
  type Pr,
  type PrKind,
  type Range,
  RANGES,
  rangeStart,
  totals,
  volumePerBucket,
  weekStreak,
  workoutsPerBucket,
} from "@/features/stats/model";
import { openExerciseChoice } from "@/features/stats/exercise-choice";
import { type StatsData, useStats } from "@/features/stats/use-stats";
import { relativeDay } from "@/lib/relative-day";
import { displayNumber, formatWeight, kgToUnit } from "@/lib/units";

const monthYear = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });

/** Profile: who you are, how training is going, and the way into Settings. */
export default function ProfileScreen() {
  const router = useRouter();
  const stats = useStats();
  const [range, setRange] = useState<Range>("3M");
  const [chosen, setChosen] = useState<ExerciseRef | undefined>();

  const data = stats.data;
  const first = data?.workouts[0];

  return (
    <Screen>
      <PageHeader
        title={data?.displayName ?? "Profile"}
        subtitle={
          first ? `Training since ${monthYear.format(new Date(first.started_at))}` : undefined
        }
        right={
          <IconAction
            icon="settings"
            label="Settings"
            onPress={() => router.push("/profile/settings")}
          />
        }
      />
      {data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <ProfileBody
            data={data}
            range={range}
            onRange={setRange}
            chosen={chosen}
            onChooseExercise={(options) =>
              openExerciseChoice(
                () => router.push("/profile/pick-exercise"),
                options,
                (ref) => setChosen(ref),
              )
            }
            onOpenExercise={(ref) => router.push({ pathname: "/exercises/[ref]", params: { ref } })}
          />
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function ProfileBody({
  data,
  range,
  onRange,
  chosen,
  onChooseExercise,
  onOpenExercise,
}: {
  data: StatsData;
  range: Range;
  onRange: (range: Range) => void;
  chosen?: ExerciseRef;
  onChooseExercise: (options: ExerciseRef[]) => void;
  onOpenExercise: (ref: ExerciseRef) => void;
}) {
  const { workouts, sets, prs, settings, describe, trackingOf, muscleOf } = data;
  const unit = settings.weight_unit;
  const view = useMemo(() => {
    const now = new Date();
    const size = bucketSizeFor(range);
    const start = rangeStart(range, now, workouts[0]?.started_at);
    const since = start.toISOString();
    const inRange = workouts.filter((w) => w.started_at >= since);
    const setsInRange = sets.filter((s) => s.performed_at >= since);
    const starts = bucketStarts(start, now, size);
    const multiYear = starts.length > 0 && starts[0]!.getFullYear() !== now.getFullYear();
    const labels = starts.map((d) => bucketLabel(d, size, multiYear));

    // The same length of time just before the range, for "+12% vs previous".
    const previousStart = new Date(start.getTime() - (now.getTime() - start.getTime()));
    const previousSets = sets.filter(
      (s) => s.performed_at >= previousStart.toISOString() && s.performed_at < since,
    );

    const weightedRefs = new Map<ExerciseRef, number>();
    for (const s of sets) {
      if (s.weight_kg === undefined || s.reps === undefined) continue;
      const t = trackingOf(s.exercise_id);
      if (t !== "weight_reps" && t !== "weighted_bodyweight") continue;
      weightedRefs.set(s.exercise_id, (weightedRefs.get(s.exercise_id) ?? 0) + 1);
    }

    return {
      size,
      since,
      labels,
      total: totals(inRange, setsInRange, trackingOf),
      perBucket: workoutsPerBucket(inRange, starts, size),
      volume: volumePerBucket(setsInRange, starts, size, trackingOf),
      previousVolume: totals([], previousSets, trackingOf).volumeKg,
      balance: muscleBalance(setsInRange, muscleOf),
      exercises: [...weightedRefs.entries()].sort((a, b) => b[1] - a[1]).map(([ref]) => ref),
      streak: weekStreak(workouts, now),
      setsInRange,
    };
  }, [range, workouts, sets, trackingOf, muscleOf]);

  const exercise = chosen ?? mostLoggedWeighted(sets, trackingOf);

  if (workouts.length === 0) {
    return (
      <>
        <Tiles workouts={0} streak={0} volume={formatTotalWeight(0, unit)} time="0 min" />
        <Card>
          <Label size="heading">Your stats live here</Label>
          <Label tone="secondary">
            Finish a workout and this fills up with workouts per week, volume, strength trends,
            muscle balance and PRs.
          </Label>
        </Card>
      </>
    );
  }

  const average =
    view.perBucket.length > 0
      ? view.perBucket.reduce((a, b) => a + b, 0) / view.perBucket.length
      : 0;
  const change =
    range === "All" ? undefined : percentChange(view.total.volumeKg, view.previousVolume);

  return (
    <>
      <Tiles
        workouts={view.total.workouts}
        streak={view.streak}
        volume={formatTotalWeight(view.total.volumeKg, unit)}
        time={formatHours(view.total.seconds)}
      />
      <Segmented options={RANGES} value={range} onChange={onRange} />

      <Card>
        <CardHeader
          title={view.size === "week" ? "Workouts per week" : "Workouts per month"}
          right={
            <Label tone="secondary" size="small">
              avg {displayNumber(Math.round(average * 10) / 10)}
            </Label>
          }
        />
        <BarChart
          values={view.perBucket}
          labels={view.labels}
          fadeLast
          accessibilityLabel={`Workouts per ${view.size}: ${view.perBucket.join(", ")}`}
        />
      </Card>

      <Card>
        <CardHeader
          title={view.size === "week" ? "Volume per week" : "Volume per month"}
          right={
            change ? (
              <Label tone={change.startsWith("+") ? "tint" : "secondary"} size="small">
                {change} vs previous
              </Label>
            ) : undefined
          }
        />
        <LineChart
          values={view.volume.map((v) => kgToUnit(v, unit))}
          labels={view.labels}
          accessibilityLabel={`Volume per ${view.size} in ${unit}`}
        />
      </Card>

      {exercise ? (
        <E1rmCard
          data={data}
          exercise={exercise}
          since={view.since}
          onChoose={() => onChooseExercise(view.exercises)}
        />
      ) : null}

      <Card>
        <CardHeader
          title="Muscle balance"
          right={
            <Label tone="secondary" size="small">
              working sets
            </Label>
          }
        />
        <HBarList
          items={view.balance.map((b) => ({ label: MUSCLE_GROUP_LABELS[b.group], value: b.sets }))}
        />
      </Card>

      <Card>
        <CardHeader
          title="Recent PRs"
          right={
            <Label tone="secondary" size="small">
              all time
            </Label>
          }
        />
        {prs.length === 0 ? (
          <Label tone="secondary" size="small">
            Beat a best weight, estimated 1RM or rep count and it shows up here.
          </Label>
        ) : (
          <View>
            {prs
              .slice(-5)
              .reverse()
              .map((pr) => (
                <Row
                  key={`${pr.workout_id}-${pr.exercise_id}-${pr.kind}`}
                  title={describe(pr.exercise_id).name}
                  subtitle={`${PR_LABELS[pr.kind]} · ${relativeDay(pr.performed_at)}`}
                  right={<Label tone="tint">{prValue(pr, unit)}</Label>}
                  onPress={() => onOpenExercise(pr.exercise_id)}
                />
              ))}
          </View>
        )}
      </Card>
    </>
  );
}

function Tiles({
  workouts,
  streak,
  volume,
  time,
}: {
  workouts: number;
  streak: number;
  volume: string;
  time: string;
}) {
  return (
    <StatTiles>
      <StatTile label="Workouts" value={String(workouts)} compact />
      <StatTile label="Week streak" value={String(streak)} accent={streak > 0} compact />
      <StatTile label="Volume" value={volume} compact />
      <StatTile label="Time" value={time} compact />
    </StatTiles>
  );
}

function E1rmCard({
  data,
  exercise,
  since,
  onChoose,
}: {
  data: StatsData;
  exercise: ExerciseRef;
  since: string;
  onChoose: () => void;
}) {
  const unit = data.settings.weight_unit;
  const name = data.describe(exercise).name;
  const points = e1rmSeries(data.sets, exercise).filter((p) => p.performed_at >= since);
  const prWorkouts = new Set(
    data.prs
      .filter((p) => p.exercise_id === exercise && p.kind === "e1rm")
      .map((p) => p.workout_id),
  );
  const best = points.reduce((m, p) => Math.max(m, p.kg), 0);
  const current = points.at(-1)?.kg;
  const dateLabel = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

  return (
    <Card>
      <CardHeader
        title="Estimated 1RM"
        right={
          <Pill
            label={name}
            icon="expand_more"
            tone="accent"
            onPress={onChoose}
            accessibilityLabel={`Exercise: ${name}. Change exercise`}
          />
        }
      />
      {current === undefined ? (
        <Label tone="secondary" size="small">
          No weighted sets of {name} in this period.
        </Label>
      ) : (
        <>
          <Label size="heading">
            {formatWeight(current, unit)}{" "}
            <Label tone="secondary" size="small">
              best {formatWeight(best, unit)}
            </Label>
          </Label>
          <LineChart
            values={points.map((p) => kgToUnit(p.kg, unit))}
            marks={points.flatMap((p, i) => (prWorkouts.has(p.workout_id) ? [i] : []))}
            labels={points.map((p) => dateLabel.format(new Date(p.performed_at)))}
            accessibilityLabel={`Estimated one-rep max for ${name}: now ${formatWeight(current, unit)}, best ${formatWeight(best, unit)}`}
          />
        </>
      )}
    </Card>
  );
}

const PR_LABELS: Record<PrKind, string> = {
  e1rm: "Est. 1RM",
  weight: "Heaviest",
  reps: "Most reps",
};

function prValue(pr: Pr, unit: "kg" | "lb"): string {
  if (pr.kind === "reps") return `${pr.value} reps`;
  if (pr.kind === "weight") return `${formatWeight(pr.value, unit)} × ${pr.set.reps ?? 0}`;
  return formatWeight(pr.value, unit);
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five * 2,
    gap: Spacing.three - 4,
  },
});
