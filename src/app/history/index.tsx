import { useRouter } from "expo-router";
import { useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";

import { Card, PageHeader, Pill, PillRow, StatTile, StatTiles } from "@/components/glas";
import { EmptyState, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Workout } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";
import { bestSets, groupByMonth, sessionStats } from "@/features/history/model";
import { formatHours, formatTotalWeight } from "@/features/stats/format";
import { bucketStart, prCountByWorkout, totals } from "@/features/stats/model";
import { useStats } from "@/features/stats/use-stats";
import { formatSet } from "@/lib/format-set";
import { useSyncOnFocus, useSyncRefresh } from "@/sync/sync-provider";

const PAGE = 30;
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export default function HistoryScreen() {
  const router = useRouter();
  const [limit, setLimit] = useState(PAGE);
  const query = useLiveQuery(
    async (r) => {
      const [sessions, custom] = await Promise.all([
        r.workouts.listHistory({ limit }),
        r.exercises.listAll(),
      ]);
      return { sessions, custom: new Map(custom.map((e) => [e.id, e])) };
    },
    [limit],
  );
  const stats = useStats();
  const { refreshing, onRefresh } = useSyncRefresh();
  useSyncOnFocus();

  const header = <PageHeader title="History" />;
  if (!query.data || !stats.data) return <Screen>{header}</Screen>;
  const { sessions, custom } = query.data;
  const { settings } = stats.data;

  if (sessions.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          title="No workouts yet"
          message="Finished workouts show up here, newest first."
        />
      </Screen>
    );
  }

  const monthStart = bucketStart(new Date(), "month").toISOString();
  const month = totals(
    stats.data.workouts.filter((w) => w.started_at >= monthStart),
    stats.data.sets.filter((s) => s.performed_at >= monthStart),
    stats.data.trackingOf,
  );
  const prs = prCountByWorkout(stats.data.prs);

  return (
    <Screen>
      {header}
      <SectionList
        sections={groupByMonth(sessions)}
        keyExtractor={(w) => w.id}
        stickySectionHeadersEnabled={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (sessions.length === limit) setLimit(limit + PAGE);
        }}
        ListHeaderComponent={
          <View style={styles.tiles}>
            <StatTiles>
              <StatTile label="This month" value={String(month.workouts)} />
              <StatTile
                label="Volume"
                value={formatTotalWeight(month.volumeKg, settings.weight_unit)}
              />
              <StatTile label="Time" value={formatHours(month.seconds)} />
            </StatTiles>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Label tone="secondary" size="small" style={styles.month} accessibilityRole="header">
            {section.title}
          </Label>
        )}
        renderItem={({ item }) => (
          <SessionCard
            workout={item}
            custom={custom}
            prs={prs.get(item.id) ?? 0}
            units={settings}
            onPress={() => router.push({ pathname: "/history/[id]", params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

function SessionCard({
  workout,
  custom,
  prs,
  units,
  onPress,
}: {
  workout: Workout;
  custom: ReadonlyMap<string, Exercise>;
  prs: number;
  units: { weight_unit: "kg" | "lb"; distance_unit: "km" | "mi" };
  onPress: () => void;
}) {
  const date = new Date(workout.started_at);
  const stats = sessionStats(workout);
  const best = bestSets(workout)
    .map(({ exercise_id, set }) => {
      const info = describeExercise(exercise_id, custom.get(exercise_id));
      return `${info.name} ${formatSet(set, info.tracking, units)}`;
    })
    .join(" · ");
  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`${workout.name}, ${date.toDateString()}`}
    >
      <View style={styles.date}>
        <Label size="heading">{date.getDate()}</Label>
        <Label tone="secondary" size="small">
          {weekday.format(date)}
        </Label>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Label size="heading" numberOfLines={1} style={styles.flex}>
            {workout.name}
          </Label>
          {prs > 0 ? (
            <Pill label={`${prs} ${prs === 1 ? "PR" : "PRs"}`} icon="trophy" tone="accent" />
          ) : null}
        </View>
        <PillRow>
          {stats.durationSeconds !== undefined ? (
            <Pill label={formatHours(stats.durationSeconds)} icon="schedule" />
          ) : null}
          <Pill label={`${stats.completedSets} sets`} />
          {stats.volumeKg > 0 ? (
            <Pill label={formatTotalWeight(stats.volumeKg, units.weight_unit)} />
          ) : null}
        </PillRow>
        {best ? (
          <Label tone="secondary" size="small" numberOfLines={2}>
            {best}
          </Label>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five * 2 },
  tiles: { paddingTop: Spacing.one },
  month: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  separator: { height: Spacing.two },
  card: { flexDirection: "row", gap: Spacing.three },
  date: { width: 40, alignItems: "center" },
  body: { flex: 1, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  flex: { flex: 1 },
});
