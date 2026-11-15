import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button, Label, Row, Screen, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { summarise } from "@/features/workout/session";
import { startSession } from "@/features/workout/start";
import { ElapsedTime } from "@/features/workout/timers";
import { useTheme } from "@/hooks/use-theme";
import { formatDuration, formatWeight } from "@/lib/units";

/** Workout tab: resume the session in progress, or start one (empty or from a program). */
export default function WorkoutHome() {
  const router = useRouter();
  const repos = useRepositories();
  const theme = useTheme();
  const query = useLiveQuery(async (r) => {
    const [active, grouped, settings, history] = await Promise.all([
      r.workouts.getActive(),
      r.routines.listGrouped(),
      r.settings.get(),
      r.workouts.listHistory({ limit: 1 }),
    ]);
    const done = history[0] ?? null;
    // "Just finished" for a quarter of an hour, then it reads as the last workout.
    const justFinished = !!done?.ended_at && Date.now() - Date.parse(done.ended_at) < 15 * 60_000;
    return { active, grouped, settings, done, justFinished };
  }, []);

  if (!query.data) return <Screen />;
  const { active, grouped, settings, done, justFinished } = query.data;
  const openActive = () => router.navigate("/active");
  const programs = grouped.folders.filter((g) => g.routines.length > 0);
  const hasTemplates = programs.length > 0 || grouped.unfiled.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        {done && !active ? (
          <FinishedCard workout={done} units={settings} justFinished={justFinished} />
        ) : null}

        {active ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <Label tone="secondary" size="small">
              In progress
            </Label>
            <Label size="heading">{active.name}</Label>
            <ElapsedTime startedAt={active.started_at} />
            <Button title="Resume workout" onPress={openActive} />
          </View>
        ) : (
          <View style={styles.pad}>
            <Button title="Start empty workout" onPress={() => startSession(repos, openActive)} />
          </View>
        )}

        {hasTemplates ? (
          <>
            {programs.map(({ folder, routines }) => (
              <View key={folder.id}>
                <SectionHeader>{folder.name}</SectionHeader>
                {routines.map((routine) => (
                  <Row
                    key={routine.id}
                    title={routine.name}
                    subtitle={`${routine.exercises.length} exercises`}
                    accessibilityLabel={`Start ${routine.name}`}
                    onPress={() => startSession(repos, openActive, routine)}
                    right={<Label tone="tint">Start</Label>}
                  />
                ))}
              </View>
            ))}
            {grouped.unfiled.length > 0 ? (
              <View>
                <SectionHeader>{programs.length > 0 ? "Other workouts" : "Workouts"}</SectionHeader>
                {grouped.unfiled.map((routine) => (
                  <Row
                    key={routine.id}
                    title={routine.name}
                    subtitle={`${routine.exercises.length} exercises`}
                    accessibilityLabel={`Start ${routine.name}`}
                    onPress={() => startSession(repos, openActive, routine)}
                    right={<Label tone="tint">Start</Label>}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Label tone="secondary" style={styles.hint}>
            Build workouts in the Programs tab to start them here with one tap.
          </Label>
        )}
      </ScrollView>
    </Screen>
  );
}

function FinishedCard({
  workout,
  units,
  justFinished,
}: {
  justFinished: boolean;
  workout: NonNullable<Awaited<ReturnType<ReturnType<typeof useRepositories>["workouts"]["get"]>>>;
  units: { weight_unit: "kg" | "lb" };
}) {
  const theme = useTheme();
  const summary = summarise(workout.exercises);
  const seconds = (Date.parse(workout.ended_at!) - Date.parse(workout.started_at)) / 1000;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: justFinished ? theme.doneRow : theme.backgroundElement },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Label size="heading">{justFinished ? "Workout saved 💪" : "Last workout"}</Label>
      <Label>{workout.name}</Label>
      <Label tone="secondary">
        {formatDuration(seconds)} · {summary.completedSets} sets ·{" "}
        {formatWeight(summary.volumeKg, units.weight_unit)} lifted
      </Label>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.five * 2 },
  card: { margin: Spacing.three, padding: Spacing.three, borderRadius: 12, gap: Spacing.two },
  pad: { padding: Spacing.three },
  hint: { padding: Spacing.three },
});
