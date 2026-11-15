import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { Chip, ChipRow, ClearableField, EmptyState, Label, Row } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { MuscleGroup } from "@/data/contract";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/labels";

import { type ExerciseListItem, filterExercises } from "./model";

/** Muscles offered as quick filters, in a gym-ish order. */
const FILTER_MUSCLES: MuscleGroup[] = [
  "chest",
  "upper_back",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
  "cardio",
];

/** Searchable, filterable list of exercises. Used by the Exercises tab (and later the picker). */
export function ExerciseBrowser({
  items,
  onSelect,
  selected,
}: {
  items: readonly ExerciseListItem[];
  onSelect: (item: ExerciseListItem) => void;
  /** Refs to tick, when picking several. */
  selected?: ReadonlySet<string>;
}) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | undefined>();
  const visible = useMemo(
    () => filterExercises(items, { search, muscle }),
    [items, search, muscle],
  );

  return (
    <FlatList
      data={visible}
      keyExtractor={(item) => item.ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View>
          <View style={styles.search}>
            <ClearableField
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises"
              accessibilityLabel="Search exercises"
              clearLabel="Clear search"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <ChipRow>
            {FILTER_MUSCLES.map((m) => (
              <Chip
                key={m}
                label={MUSCLE_LABELS[m]}
                selected={muscle === m}
                onPress={() => setMuscle(muscle === m ? undefined : m)}
              />
            ))}
          </ChipRow>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No exercises found"
          message="Try another search, or create your own exercise."
        />
      }
      renderItem={({ item }) => (
        <Row
          title={item.name}
          subtitle={`${MUSCLE_LABELS[item.primary_muscle]} · ${EQUIPMENT_LABELS[item.equipment]}`}
          onPress={() => onSelect(item)}
          accessibilityLabel={selected?.has(item.ref) ? `${item.name}, selected` : undefined}
          right={
            <>
              {item.custom ? (
                <Label tone="tint" size="small">
                  Custom
                </Label>
              ) : null}
              {selected?.has(item.ref) ? (
                <Label tone="tint" size="heading">
                  ✓
                </Label>
              ) : null}
            </>
          }
        />
      )}
      extraData={selected}
    />
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
