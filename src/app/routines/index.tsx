import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

import { Button, EmptyState, HeaderButton, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, RoutineFolder, Timestamp } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";
import { useTheme } from "@/hooks/use-theme";
import { relativeDay } from "@/lib/relative-day";

const GAP = Spacing.three;

type Group = { folder?: RoutineFolder; title: string; routines: Routine[] };

/** Programs, each a collapsible group of Workout cards two to a row. */
export default function RoutinesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const query = useLiveQuery(async (r) => {
    const [grouped, custom, lastDone] = await Promise.all([
      r.routines.listGrouped(),
      r.exercises.listAll(),
      r.workouts.lastDoneByRoutine(),
    ]);
    return { grouped, custom: new Map(custom.map((e) => [e.id, e])), lastDone };
  }, []);

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

  if (!query.data) return <Screen />;
  const { grouped, custom, lastDone } = query.data;
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
  const empty = grouped.folders.length === 0 && grouped.unfiled.length === 0;
  const cardWidth = (width - Spacing.three * 2 - GAP) / 2;

  return (
    <Screen>
      <Stack.Screen
        options={{ headerRight: () => <HeaderButton title="New" onPress={showNewMenu} /> }}
      />
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
        <ScrollView contentContainerStyle={styles.content}>
          {groups.map((group) => {
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
                    <Label size="heading" tone="secondary" style={styles.chevron}>
                      {open ? "▾" : "▸"}
                    </Label>
                    <Label size="heading" numberOfLines={1} style={styles.flex}>
                      {group.title} <Label tone="secondary">({group.routines.length})</Label>
                    </Label>
                  </Pressable>
                  {group.folder ? (
                    <>
                      <HeaderButton title="+" onPress={() => newRoutine(group.folder!.id)} />
                      <HeaderButton title="Edit" onPress={() => editFolder(group.folder!.id)} />
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
                          width={cardWidth}
                          onPress={() =>
                            router.push({ pathname: "/routines/[id]", params: { id: routine.id } })
                          }
                        />
                      ))}
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

function WorkoutCard({
  routine,
  custom,
  lastDone,
  width,
  onPress,
}: {
  routine: Routine;
  custom: ReadonlyMap<string, Exercise>;
  lastDone?: Timestamp;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { width, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Label size="heading" numberOfLines={2}>
        {routine.name}
      </Label>
      <Label tone="secondary" size="small" numberOfLines={3} style={styles.flex}>
        {exerciseNames(routine, custom)}
      </Label>
      <Label tone="secondary" size="small">
        {lastDone ? `🕒 ${relativeDay(lastDone)}` : "Not done yet"}
      </Label>
    </Pressable>
  );
}

function exerciseNames(routine: Routine, custom: ReadonlyMap<string, Exercise>): string {
  if (routine.exercises.length === 0) return "No exercises";
  return routine.exercises
    .map((e) => describeExercise(e.exercise_id, custom.get(e.exercise_id)).name)
    .join(", ");
}

const styles = StyleSheet.create({
  empty: { padding: Spacing.three, gap: Spacing.three },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.five * 2 },
  group: { gap: Spacing.two },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  groupTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.one },
  chevron: { width: 18 },
  flex: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  card: {
    minHeight: 130,
    padding: Spacing.three,
    gap: Spacing.one,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
