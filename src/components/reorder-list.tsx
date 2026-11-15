import { Pressable, StyleSheet, View } from "react-native";
import ReorderableList, { useReorderableDrag } from "react-native-reorderable-list";

import { Button, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ReorderItem = { key: string; name: string; detail?: string };

/**
 * A compact list to drag into a new order (exercises in a session or a Workout). Hold a row, or
 * touch its ≡ handle, then drag.
 */
export function ReorderList({
  items,
  onMove,
  onDone,
}: {
  items: ReorderItem[];
  onMove: (from: number, to: number) => void;
  onDone: () => void;
}) {
  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Label tone="secondary" style={styles.flex}>
          Hold ≡ and drag to reorder.
        </Label>
        <Button title="Done" onPress={onDone} />
      </View>
      <ReorderableList
        data={items}
        keyExtractor={(item) => item.key}
        onReorder={({ from, to }) => onMove(from, to)}
        renderItem={({ item }) => <ReorderRow item={item} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function ReorderRow({ item }: { item: ReorderItem }) {
  const theme = useTheme();
  const drag = useReorderableDrag();
  return (
    <Pressable
      onLongPress={drag}
      delayLongPress={150}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={styles.flex}>
        <Label size="heading">{item.name}</Label>
        {item.detail ? (
          <Label tone="secondary" size="small">
            {item.detail}
          </Label>
        ) : null}
      </View>
      <Pressable
        onPressIn={drag}
        accessibilityLabel={`Drag ${item.name}`}
        hitSlop={12}
        style={styles.handle}
      >
        <Label size="title" tone="secondary">
          ≡
        </Label>
      </Pressable>
    </Pressable>
  );
}

export const setCount = (n: number) => `${n} ${n === 1 ? "set" : "sets"}`;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.two,
  },
  handle: { paddingHorizontal: Spacing.two },
});
