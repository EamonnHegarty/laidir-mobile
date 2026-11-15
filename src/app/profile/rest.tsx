import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { RowGroup } from "@/components/glas";
import { EmptyState, Label, Row, Screen } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { describeExercise } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { RestPicker, restLabel } from "@/features/workout/rest-picker";

/** The rest times chosen per exercise during workouts: change one, or reset it to the default. */
export default function ExerciseRestScreen() {
  const repos = useRepositories();
  const [editing, setEditing] = useState<string | null>(null);
  const query = useLiveQuery(async (r) => {
    const [rests, custom, settings] = await Promise.all([
      r.settings.exerciseRest(),
      r.exercises.listAll(),
      r.settings.get(),
    ]);
    const byId = new Map(custom.map((e) => [e.id, e]));
    const items = [...rests.entries()]
      .map(([ref, seconds]) => ({ ref, seconds, info: describeExercise(ref, byId.get(ref)) }))
      // Keys for deleted custom exercises can stay in the map; don't list them.
      .filter((item) => item.info.source !== "unknown")
      .sort((a, b) => a.info.name.localeCompare(b.info.name));
    return { items, fallback: settings.default_rest_seconds };
  }, []);

  if (!query.data) return <Screen />;
  const { items, fallback } = query.data;
  const current = items.find((i) => i.ref === editing);

  return (
    <Screen>
      {items.length === 0 ? (
        <EmptyState
          title="No per-exercise rest yet"
          message="Tap the timer on an exercise during a workout to give it its own rest time."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Label tone="secondary" size="small">
            These win over a workout&apos;s rest and the default ({restLabel(fallback)}).
          </Label>
          <RowGroup>
            {items.map((item) => (
              <Row
                key={item.ref}
                title={item.info.name}
                onPress={() => setEditing(item.ref)}
                right={<Label tone="tint">{restLabel(item.seconds)}</Label>}
              />
            ))}
          </RowGroup>
        </ScrollView>
      )}
      {current ? (
        <RestPicker
          exerciseName={current.info.name}
          current={current.seconds}
          chosen
          fallback={fallback}
          onChoose={(seconds) => void repos.settings.setExerciseRest(current.ref, seconds)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five * 2 },
});
