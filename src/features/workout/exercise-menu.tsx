import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type MenuAction = {
  label: string;
  icon: IconName;
  onPress: () => void;
  danger?: boolean;
};

/** A bottom sheet of actions for one exercise in a workout (tap outside or Back to close). */
export function ExerciseMenu({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          <Label size="heading" numberOfLines={1} style={styles.title}>
            {title}
          </Label>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.action,
                pressed && { backgroundColor: theme.control },
              ]}
            >
              <Icon
                name={action.icon}
                size={22}
                color={action.danger ? theme.danger : theme.textSecondary}
              />
              <Label tone={action.danger ? "danger" : "default"}>{action.label}</Label>
            </Pressable>
          ))}
          <View style={styles.spacer} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderRadius: 12,
  },
  spacer: { height: Spacing.five },
});
