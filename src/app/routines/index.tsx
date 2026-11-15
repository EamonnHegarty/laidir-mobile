import { Stack, useRouter } from "expo-router";
import { Alert, SectionList, StyleSheet, View } from "react-native";

import { Button, EmptyState, HeaderButton, Label, Row, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import type { Exercise, Routine, RoutineFolder } from "@/data/contract";
import { useLiveQuery } from "@/data/database-provider";

type Section = { folder?: RoutineFolder; title: string; data: Routine[] };

export default function RoutinesScreen() {
  const router = useRouter();
  const query = useLiveQuery(async (r) => {
    const [grouped, custom] = await Promise.all([r.routines.listGrouped(), r.exercises.listAll()]);
    return { grouped, custom: new Map(custom.map((e) => [e.id, e])) };
  }, []);

  const newRoutine = (folderId?: string) =>
    router.push({ pathname: "/routines/edit", params: folderId ? { folder: folderId } : {} });
  const newFolder = () => router.push("/routines/folder");

  const showNewMenu = () =>
    Alert.alert("Create", undefined, [
      { text: "New folder", onPress: newFolder },
      { text: "New routine", onPress: () => newRoutine() },
      { text: "Cancel", style: "cancel" },
    ]);

  if (!query.data) return <Screen />;
  const { grouped, custom } = query.data;
  const sections: Section[] = [
    ...grouped.folders.map((g) => ({ folder: g.folder, title: g.folder.name, data: g.routines })),
    ...(grouped.unfiled.length > 0 || grouped.folders.length === 0
      ? [{ title: grouped.folders.length > 0 ? "Other routines" : "", data: grouped.unfiled }]
      : []),
  ];
  const empty = grouped.folders.length === 0 && grouped.unfiled.length === 0;

  return (
    <Screen>
      <Stack.Screen
        options={{ headerRight: () => <HeaderButton title="New" onPress={showNewMenu} /> }}
      />
      {empty ? (
        <View style={styles.empty}>
          <EmptyState
            title="No routines yet"
            message="Build a routine once, then start a workout from it. Group them into folders like Push/Pull/Legs."
          />
          <Button title="New routine" onPress={() => newRoutine()} />
          <Button title="New folder" tone="plain" onPress={newFolder} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(routine) => routine.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <View style={styles.sectionHeader}>
                <Label size="heading" style={styles.flex} accessibilityRole="header">
                  {section.title}
                </Label>
                {section.folder ? (
                  <>
                    <HeaderButton title="+" onPress={() => newRoutine(section.folder!.id)} />
                    <HeaderButton
                      title="Edit"
                      onPress={() =>
                        router.push({
                          pathname: "/routines/folder",
                          params: { id: section.folder!.id },
                        })
                      }
                    />
                  </>
                ) : null}
              </View>
            ) : null
          }
          renderSectionFooter={({ section }) =>
            section.folder && section.data.length === 0 ? (
              <Label tone="secondary" size="small" style={styles.emptyFolder}>
                No routines in this folder yet. Tap + to add one.
              </Label>
            ) : null
          }
          renderItem={({ item }) => (
            <Row
              title={item.name}
              subtitle={exerciseNames(item, custom)}
              onPress={() => router.push({ pathname: "/routines/[id]", params: { id: item.id } })}
            />
          )}
        />
      )}
    </Screen>
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.one,
  },
  flex: { flex: 1 },
  emptyFolder: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
