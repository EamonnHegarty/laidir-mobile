import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";

import { Button, EmptyState, Field, Label, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { RoutineFolder } from "@/data/contract";
import { useLiveQuery, useRepositories } from "@/data/database-provider";

/** New folder, or rename / delete folder `id`. */
export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const query = useLiveQuery(
    async (r) => (id ? ((await r.routines.listFolders()).find((f) => f.id === id) ?? null) : null),
    [id],
  );

  if (query.status === "loading") return <Screen />;
  if (id && !query.data) {
    return (
      <Screen>
        <EmptyState title="Program not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return <FolderForm folder={query.data ?? undefined} />;
}

function FolderForm({ folder }: { folder?: RoutineFolder }) {
  const router = useRouter();
  const repos = useRepositories();
  const [name, setName] = useState(folder?.name ?? "");
  const [problem, setProblem] = useState<string>();

  const save = async () => {
    try {
      if (folder) await repos.routines.renameFolder(folder.id, name);
      else await repos.routines.createFolder(name);
      router.back();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  const confirmDelete = (target: RoutineFolder) =>
    Alert.alert(
      `Delete ${target.name}?`,
      "The program is removed. Its workouts are kept and move to Other workouts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete program",
          style: "destructive",
          onPress: async () => {
            await repos.routines.removeFolder(target.id);
            router.back();
          },
        },
      ],
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: folder ? "Edit program" : "New program" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          value={name}
          onChangeText={setName}
          placeholder="Program name, e.g. Push/Pull/Legs"
          accessibilityLabel="Program name"
          maxLength={100}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {problem ? <Label tone="danger">{problem}</Label> : null}
        <Button title={folder ? "Save" : "Create program"} onPress={save} />
        {folder ? (
          <Button title="Delete program" tone="danger" onPress={() => confirmDelete(folder)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three },
});
