import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { MAX_NOTE } from "./session";

/**
 * Writes an exercise's note in a sheet pinned to the top of the screen, so the keyboard never
 * covers it and scrolling the workout behind can't close it. Save keeps the text (empty clears
 * the note); Cancel, the back button or a tap outside leaves it unchanged.
 */
export function NoteEditor({
  exerciseName,
  initial,
  onSave,
  onClose,
}: {
  exerciseName: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  const save = () => {
    onSave(text);
    onClose();
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel note">
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingTop: insets.top + Spacing.three },
          ]}
        >
          <Label size="heading">Note</Label>
          <Label tone="secondary">{exerciseName}</Label>
          <Field
            autoFocus
            value={text}
            onChangeText={setText}
            placeholder="e.g. seat on 4"
            accessibilityLabel={`Note for ${exerciseName}`}
            maxLength={MAX_NOTE}
            multiline
            scrollEnabled
            style={styles.field}
          />
          <View style={styles.actions}>
            <Button title="Cancel" tone="plain" onPress={onClose} style={styles.flex} />
            <Button title="Save" onPress={save} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-start", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  // Grows with the text up to a few lines, then scrolls inside the field.
  field: { minHeight: 96, maxHeight: 200, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.one },
  flex: { flex: 1 },
});
