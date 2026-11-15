import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { ClearableField, EmptyState, Row, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import { useLiveQuery } from "@/data/database-provider";
import { pendingExerciseChoice, resolveExerciseChoice } from "@/features/stats/exercise-choice";

/** Picks which exercise the Profile's estimated-1RM chart shows. */
export default function PickChartExercise() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const custom = useLiveQuery((r) => r.exercises.listAll(), []);
  const byId = new Map((custom.data ?? []).map((e) => [e.id, e]));
  const options = (pendingExerciseChoice()?.options ?? []).map((ref) =>
    describeExercise(ref, byId.get(ref)),
  );
  const term = search.trim().toLowerCase();
  const visible = term ? options.filter((o) => o.name.toLowerCase().includes(term)) : options;

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.ref}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.search}>
            <ClearableField
              icon="search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search your exercises"
              accessibilityLabel="Search your exercises"
              clearLabel="Clear search"
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing to chart yet"
            message="Exercises you've logged with weight and reps show up here."
          />
        }
        renderItem={({ item }) => (
          <Row
            title={item.name}
            onPress={() => {
              resolveExerciseChoice(item.ref);
              router.back();
            }}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { padding: Spacing.three },
});
