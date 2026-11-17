import { useState } from "react";
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { Button, Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { RoutineFolder } from "@/data/contract";
import { useTheme } from "@/hooks/use-theme";

/**
 * "Move to…" for one workout: every program, "No program", and "New program" (name it here and the
 * workout goes straight into it). The current program is ticked. Tap outside or Back to close.
 */
export function MoveSheet({
  workoutName,
  folders,
  currentFolderId,
  onMove,
  onCreateAndMove,
  onClose,
}: {
  workoutName: string;
  folders: readonly RoutineFolder[];
  currentFolderId: string | undefined;
  /** `undefined` = out of any program. */
  onMove: (folderId: string | undefined) => void;
  onCreateAndMove: (programName: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const pick = (folderId: string | undefined) => {
    onClose();
    if (folderId !== currentFolderId) onMove(folderId);
  };
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    onClose();
    onCreateAndMove(trimmed);
  };

  const option = (
    key: string,
    label: string,
    folderId: string | undefined,
    icon: "list_alt" | "remove",
  ) => {
    const current = folderId === currentFolderId;
    return (
      <Pressable
        key={key}
        onPress={() => pick(folderId)}
        accessibilityRole="button"
        accessibilityState={{ selected: current }}
        accessibilityLabel={current ? `${label}, current` : `Move to ${label}`}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.control }]}
      >
        <Icon name={icon} size={22} color={current ? theme.tint : theme.textSecondary} />
        <Label tone={current ? "tint" : "default"} numberOfLines={1} style={styles.flex}>
          {label}
        </Label>
        {current ? <Icon name="check" size={20} color={theme.tint} /> : null}
      </Pressable>
    );
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
          <Label size="heading" numberOfLines={1} style={styles.title}>
            Move {workoutName} to
          </Label>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {folders.map((folder) => option(folder.id, folder.name, folder.id, "list_alt"))}
            {option("none", "No program", undefined, "remove")}
            {naming ? (
              <View style={styles.newProgram}>
                <Field
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Push Pull Legs"
                  accessibilityLabel="New program name"
                  maxLength={100}
                  returnKeyType="done"
                  onSubmitEditing={create}
                />
                <Button
                  title={`Create and move ${workoutName}`}
                  onPress={create}
                  disabled={!name.trim()}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setNaming(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.control }]}
              >
                <Icon name="add" size={22} color={theme.tint} />
                <Label tone="tint">New program…</Label>
              </Pressable>
            )}
          </ScrollView>
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
    maxHeight: "80%",
  },
  title: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  list: { flexGrow: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newProgram: { gap: Spacing.two, padding: Spacing.three },
  flex: { flex: 1 },
  spacer: { height: Spacing.five },
});
