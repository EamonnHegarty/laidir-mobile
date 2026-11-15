import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Button, Chip, ChipGrid, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { formatDuration } from "@/lib/units";

export const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300] as const;

/** "2:00", or "Off" for no timer. */
export function restLabel(seconds: number): string {
  return seconds === 0 ? "Off" : formatDuration(seconds);
}

/**
 * Bottom sheet for an exercise's rest timer. `fallback` is what applies with nothing chosen
 * (the Workout template's rest or the default), offered as "Reset".
 */
export function RestPicker({
  exerciseName,
  current,
  chosen,
  fallback,
  onChoose,
  onClose,
}: {
  exerciseName: string;
  /** The rest in effect now. */
  current: number;
  /** True when the user picked `current` for this exercise (so Reset makes sense). */
  chosen: boolean;
  fallback: number;
  onChoose: (seconds: number | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const pick = (seconds: number | null) => {
    onChoose(seconds);
    onClose();
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]}>
          <Label size="heading">Rest timer</Label>
          <Label tone="secondary">{exerciseName}: used every time you do this exercise.</Label>
          <ChipGrid>
            {REST_CHOICES.map((seconds) => (
              <Chip
                key={seconds}
                label={restLabel(seconds)}
                selected={current === seconds}
                onPress={() => pick(seconds)}
              />
            ))}
            <Chip label="Off" selected={current === 0} onPress={() => pick(0)} />
          </ChipGrid>
          <View style={styles.actions}>
            {chosen ? (
              <Button
                title={`Reset to ${restLabel(fallback)}`}
                tone="plain"
                onPress={() => pick(null)}
                style={styles.flex}
              />
            ) : null}
            <Button title="Done" tone="plain" onPress={onClose} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  actions: { flexDirection: "row", gap: Spacing.two },
  flex: { flex: 1 },
});
