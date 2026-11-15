import { useRouter } from "expo-router";
import { useState } from "react";
import { SectionList, StyleSheet } from "react-native";

import { EmptyState, Row, Screen, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Workout } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";
import { groupByMonth, sessionStats } from "@/features/history/model";
import { formatDuration, formatWeight } from "@/lib/units";

const PAGE = 30;
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });

export default function HistoryScreen() {
  const router = useRouter();
  const [limit, setLimit] = useState(PAGE);
  const query = useLiveQuery(
    async (r) => {
      const [sessions, custom, settings] = await Promise.all([
        r.workouts.listHistory({ limit }),
        r.exercises.listAll(),
        r.settings.get(),
      ]);
      return { sessions, custom: new Map(custom.map((e) => [e.id, e])), settings };
    },
    [limit],
  );

  if (!query.data) return <Screen />;
  const { sessions, custom, settings } = query.data;

  if (sessions.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="No workouts yet"
          message="Finished workouts show up here, newest first."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionList
        sections={groupByMonth(sessions)}
        keyExtractor={(w) => w.id}
        stickySectionHeadersEnabled={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (sessions.length === limit) setLimit(limit + PAGE);
        }}
        renderSectionHeader={({ section }) => <SectionHeader>{section.title}</SectionHeader>}
        renderItem={({ item }) => (
          <Row
            title={`${dayFormat.format(new Date(item.started_at))} · ${item.name}`}
            subtitle={summaryLine(item, custom, settings.weight_unit)}
            onPress={() => router.push({ pathname: "/history/[id]", params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.content}
      />
    </Screen>
  );
}

function summaryLine(
  workout: Workout,
  custom: ReadonlyMap<string, Exercise>,
  unit: "kg" | "lb",
): string {
  const stats = sessionStats(workout);
  const parts = [
    stats.durationSeconds === undefined ? undefined : formatDuration(stats.durationSeconds),
    `${stats.completedSets} sets`,
    stats.volumeKg > 0 ? formatWeight(stats.volumeKg, unit) : undefined,
  ].filter(Boolean);
  const names = workout.exercises
    .map((e) => describeExercise(e.exercise_id, custom.get(e.exercise_id)).name)
    .join(", ");
  return `${parts.join(" · ")}\n${names}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.five * 2 },
});
