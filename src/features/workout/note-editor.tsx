import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { Button, Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { MAX_NOTE } from "./session";

/**
 * Writes a note in a card centred on the screen. It lifts above the keyboard, and scrolling the
 * workout behind can't close it. Save keeps the text (empty clears the note); Cancel, the back
 * button or a tap outside leaves it unchanged.
 */
export function NoteEditor({
  title = "Note",
  exerciseName,
  initial,
  placeholder = "e.g. seat on 4",
  onSave,
  onClose,
}: {
  title?: string;
  /** Shown under the title: the exercise (or workout) the note belongs to. */
  exerciseName: string;
  placeholder?: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(initial);
  const save = () => {
    onSave(text);
    onClose();
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cancel note">
          <Pressable style={[styles.card, { backgroundColor: theme.background }]}>
            <Label size="heading">{title}</Label>
            <Label tone="secondary">{exerciseName}</Label>
            <Field
              autoFocus
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              accessibilityLabel={title === "Note" ? `Note for ${exerciseName}` : title}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.three,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: { padding: Spacing.three, gap: Spacing.two, borderRadius: 16 },
  // Grows with the text up to a few lines, then scrolls inside the field.
  field: { minHeight: 96, maxHeight: 200, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.one },
  flex: { flex: 1 },
});
