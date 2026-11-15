import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { Card, DashedButton, IconAction, PageHeader, Pill, PillRow } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Button, EmptyState, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, RoutineFolder, Timestamp, Workout } from "@/data/contract";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { formatHours, formatTotalWeight } from "@/features/stats/format";
import { nextUpByFolder } from "@/features/stats/model";
import { summarise } from "@/features/workout/session";
import { startSession } from "@/features/workout/start";
import { ElapsedTime } from "@/features/workout/timers";
import { useTheme } from "@/hooks/use-theme";
import { relativeDay } from "@/lib/relative-day";

const GAP = Spacing.two;

type Group = { folder?: RoutineFolder; title: string; routines: Routine[] };

/**
 * Programs, the home tab: resume or start a workout, then each Program as a collapsible group of
 * Workout cards, two to a row.
 */
export default function ProgramsScreen() {
  const router = useRouter();
  const repos = useRepositories();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const query = useLiveQuery(async (r) => {
    const [grouped, custom, lastDone, active, latest, settings] = await Promise.all([
      r.routines.listGrouped(),
      r.exercises.listAll(),
      r.workouts.lastDoneByRoutine(),
      r.workouts.getActive(),
      r.workouts.listHistory({ limit: 1 }),
      r.settings.get(),
    ]);
    const done = latest[0];
    // "Workout saved" for a quarter of an hour after finishing.
    const justFinished =
      done?.ended_at !== undefined && Date.now() - Date.parse(done.ended_at) < 15 * 60_000
        ? done
        : undefined;
    return {
      grouped,
      custom: new Map(custom.map((e) => [e.id, e])),
      lastDone,
      active,
      justFinished,
      settings,
    };
  }, []);

  const openActive = () => router.navigate("/active");
  const start = (routine?: Routine) => void startSession(repos, openActive, routine);
  const newRoutine = (folderId?: string) =>
    router.push({ pathname: "/routines/edit", params: folderId ? { folder: folderId } : {} });
  const newFolder = () => router.push("/routines/folder");
  const editFolder = (id: string) => router.push({ pathname: "/routines/folder", params: { id } });
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const showNewMenu = () =>
    Alert.alert("Create", undefined, [
      { text: "New program", onPress: newFolder },
      { text: "New workout", onPress: () => newRoutine() },
      { text: "Cancel", style: "cancel" },
    ]);

  const header = (
    <PageHeader
      title="Programs"
      right={
        <IconAction icon="add" label="New program or workout" tone="tint" onPress={showNewMenu} />
      }
    />
  );
  if (!query.data) return <Screen>{header}</Screen>;
  const { grouped, custom, lastDone, active, justFinished, settings } = query.data;
  const groups: Group[] = [
    ...grouped.folders.map((g) => ({
      folder: g.folder,
      title: g.folder.name,
      routines: g.routines,
    })),
    ...(grouped.unfiled.length > 0
      ? [
          {
            title: grouped.folders.length > 0 ? "Other workouts" : "My workouts",
            routines: grouped.unfiled,
          },
        ]
      : []),
  ];
  const nextUp = nextUpByFolder(grouped.folders, lastDone);
  const empty = groups.length === 0;
  const cardWidth = (width - Spacing.three * 2 - GAP) / 2;

  return (
    <Screen>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {active ? (
          <ResumeBanner workout={active} onPress={openActive} />
        ) : (
          <>
            {justFinished ? (
              <FinishedCard workout={justFinished} unit={settings.weight_unit} />
            ) : null}
            <DashedButton title="Start an empty workout" onPress={() => start()} />
          </>
        )}

        {empty ? (
          <View style={styles.empty}>
            <EmptyState
              title="No programs yet"
              message="Make a program like Push/Pull/Legs, add its workouts (Push, Pull, Legs), then start one when you train."
            />
            <Button title="New program" onPress={newFolder} />
            <Button title="New workout" tone="plain" onPress={() => newRoutine()} />
          </View>
        ) : (
          groups.map((group) => {
            const key = group.folder?.id ?? "unfiled";
            const open = !collapsed.has(key);
            return (
              <View key={key} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Pressable
                    onPress={() => toggle(key)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${group.title}, ${group.routines.length} workouts`}
                    style={styles.groupTitle}
                  >
                    <Icon name={open ? "expand_more" : "chevron_right"} size={22} />
                    <Label size="heading" numberOfLines={1} style={styles.shrink}>
                      {group.title}
                    </Label>
                    <Pill label={String(group.routines.length)} />
                  </Pressable>
                  {group.folder ? (
                    <>
                      <IconAction
                        icon="add"
                        label={`Add a workout to ${group.title}`}
                        onPress={() => newRoutine(group.folder!.id)}
                      />
                      <IconAction
                        icon="more_horiz"
                        label={`Edit ${group.title}`}
                        onPress={() => editFolder(group.folder!.id)}
                      />
                    </>
                  ) : null}
                </View>
                {open ? (
                  group.routines.length === 0 ? (
                    <Label tone="secondary" size="small">
                      No workouts in this program yet. Tap + to add one.
                    </Label>
                  ) : (
                    <View style={styles.grid}>
                      {group.routines.map((routine) => (
                        <WorkoutCard
                          key={routine.id}
                          routine={routine}
                          custom={custom}
                          lastDone={lastDone.get(routine.id)}
                          nextUp={nextUp.has(routine.id)}
                          width={cardWidth}
                          onPress={() =>
                            router.push({ pathname: "/routines/[id]", params: { id: routine.id } })
                          }
                          onStart={() => start(routine)}
                        />
                      ))}
                    </View>
                  )
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function ResumeBanner({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const theme = useTheme();
  const { completedSets } = summarise(workout.exercises);
  const total = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  return (
    <Card
      active
      onPress={onPress}
      accessibilityLabel={`${workout.name} in progress, ${completedSets} of ${total} sets done. Resume`}
      style={styles.banner}
    >
      <Icon name="play_arrow" size={28} color={theme.tint} />
      <View style={styles.flex}>
        <Label tone="tint" size="heading" numberOfLines={1}>
          {workout.name} in progress
        </Label>
        <View style={styles.bannerMeta}>
          <ElapsedTime startedAt={workout.started_at} />
          <Label tone="secondary">
            · {completedSets} of {total} sets
          </Label>
        </View>
      </View>
      <View style={[styles.resume, { backgroundColor: theme.tint }]}>
        <Label style={{ color: theme.onTint }} size="small">
          Resume
        </Label>
      </View>
    </Card>
  );
}

function FinishedCard({ workout, unit }: { workout: Workout; unit: "kg" | "lb" }) {
  const { completedSets, volumeKg } = summarise(workout.exercises);
  const seconds = (Date.parse(workout.ended_at!) - Date.parse(workout.started_at)) / 1000;
  return (
    <Card active accessibilityLabel="Workout saved">
      <Label size="heading" tone="tint">
        Workout saved
      </Label>
      <Label>{workout.name}</Label>
      <PillRow>
        <Pill label={formatHours(seconds)} icon="schedule" />
        <Pill label={`${completedSets} sets`} />
        {volumeKg > 0 ? <Pill label={formatTotalWeight(volumeKg, unit)} /> : null}
      </PillRow>
    </Card>
  );
}

function WorkoutCard({
  routine,
  custom,
  lastDone,
  nextUp,
  width,
  onPress,
  onStart,
}: {
  routine: Routine;
  custom: ReadonlyMap<string, Exercise>;
  lastDone?: Timestamp;
  nextUp: boolean;
  width: number;
  onPress: () => void;
  onStart: () => void;
}) {
  const theme = useTheme();
  const count = routine.exercises.length;
  return (
    <Card onPress={onPress} style={[styles.card, { width }]}>
      <View style={styles.cardTop}>
        <Label size="heading" numberOfLines={2} style={styles.flex}>
          {routine.name}
        </Label>
        <IconAction
          icon="play_arrow"
          label={`Start ${routine.name}`}
          tone="tint"
          onPress={onStart}
        />
      </View>
      <Label tone="secondary" size="small" numberOfLines={3} style={styles.flex}>
        {exerciseNames(routine, custom)}
      </Label>
      <PillRow>
        {nextUp ? (
          <Pill label="Next up" tone="accent" />
        ) : (
          <Pill label={`${count} ${count === 1 ? "exercise" : "exercises"}`} />
        )}
      </PillRow>
      <View style={styles.lastDone}>
        <Icon name="schedule" size={14} color={theme.textSecondary} />
        <Label tone="secondary" size="small">
          {lastDone ? relativeDay(lastDone) : "Not done yet"}
        </Label>
      </View>
    </Card>
  );
}

function exerciseNames(routine: Routine, custom: ReadonlyMap<string, Exercise>): string {
  if (routine.exercises.length === 0) return "No exercises";
  return routine.exercises
    .map((e) => describeExercise(e.exercise_id, custom.get(e.exercise_id)).name)
    .join(", ");
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five * 2,
    gap: Spacing.three,
  },
  empty: { gap: Spacing.three },
  group: { gap: Spacing.two },
  groupHeader: { flexDirection: "row", alignItems: "center" },
  groupTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  shrink: { flexShrink: 1 },
  flex: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  card: { minHeight: 150 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginRight: -8, marginTop: -6 },
  lastDone: { flexDirection: "row", alignItems: "center", gap: 4 },
  banner: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  bannerMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  resume: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
});
