import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon, type IconName } from "@/components/icon";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * A note in a workout (an exercise's or the workout's own), in its own highlighted box. Tap to
 * edit; swipe it right to left to delete it (the accessibility action does the same).
 *
 * Swiping is set up like the set rows: only a clear sideways drag to the left starts it, so
 * scrolling the page up or down over a note never gets caught.
 */
export function NoteBox({
  text,
  icon = "sticky_note_2",
  label,
  onEdit,
  onDelete,
}: {
  text: string;
  icon?: IconName;
  /** What the note belongs to, for screen readers: "Note" or "Workout note". */
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={SWIPE_TO_DELETE}
      overshootRight={false}
      dragOffsetFromRight={-24}
      dragOffsetFromLeft={10_000}
      onSwipeableOpen={onDelete}
      renderRightActions={() => (
        <View style={[styles.deleteAction, { backgroundColor: theme.danger }]}>
          <Icon name="delete" size={20} color={theme.onTint} />
          <Text style={[styles.deleteText, { color: theme.onTint }]}>Delete</Text>
        </View>
      )}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}. Edit note`}
        accessibilityHint="Swipe left to delete the note."
        accessibilityActions={[{ name: "delete", label: "Delete note" }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "delete") onDelete();
        }}
        style={({ pressed }) => [
          styles.box,
          { backgroundColor: theme.control, borderLeftColor: theme.tint },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Icon name={icon} size={16} color={theme.tint} />
        <Label size="small" style={styles.flex}>
          {text}
        </Label>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** How far (px) the note must be swiped left, and released, to delete it. */
const SWIPE_TO_DELETE = 96;

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  deleteAction: {
    width: 88,
    marginLeft: Spacing.one,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  deleteText: { fontSize: 12, fontWeight: 600 },
  flex: { flex: 1 },
});
