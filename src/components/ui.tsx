// Small shared building blocks so screens look consistent. Colours come from the theme.
import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { Icon, type IconName } from "./icon";

export function Screen({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.screen, { backgroundColor: theme.background }, style]} {...props} />;
}

type Tone = "default" | "secondary" | "danger" | "tint";

export function Label({
  tone = "default",
  size = "body",
  style,
  ...props
}: TextProps & { tone?: Tone; size?: "body" | "small" | "title" | "heading" }) {
  const theme = useTheme();
  const color =
    tone === "secondary"
      ? theme.textSecondary
      : tone === "danger"
        ? theme.danger
        : tone === "tint"
          ? theme.tint
          : theme.text;
  return <Text style={[styles[size], { color }, style]} {...props} />;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Label tone="secondary" size="small" style={styles.sectionHeader} accessibilityRole="header">
      {children}
    </Label>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}
    >
      <View style={styles.rowText}>
        <Label>{title}</Label>
        {subtitle ? (
          <Label tone="secondary" size="small">
            {subtitle}
          </Label>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? theme.doneRow : theme.backgroundElement }]}
    >
      <Text style={[styles.chipText, { color: selected ? theme.tint : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/** A horizontally scrolling row of chips, e.g. filters. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Chips that wrap onto several lines, e.g. picking from an enum in a form. */
export function ChipGrid({ children }: { children: ReactNode }) {
  return <View style={styles.chipGrid}>{children}</View>;
}

export function Field({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[styles.field, { backgroundColor: theme.backgroundElement, color: theme.text }, style]}
      {...props}
    />
  );
}

/**
 * A text field with an ✕ at the end that clears it (Android has no built-in clear button). The ✕
 * only shows while there's text.
 */
export function ClearableField({
  value,
  onChangeText,
  style,
  clearLabel = "Clear text",
  icon,
  ...props
}: TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  clearLabel?: string;
  /** Shown at the start of the field, e.g. "search". */
  icon?: IconName;
}) {
  const theme = useTheme();
  return (
    <View style={styles.clearable}>
      <Field
        value={value}
        onChangeText={onChangeText}
        style={[value ? styles.clearablePadding : null, icon ? styles.iconPadding : null, style]}
        {...props}
      />
      {icon ? (
        <View style={styles.leadingIcon} pointerEvents="none">
          <Icon name={icon} size={20} />
        </View>
      ) : null}
      {value ? (
        <Pressable
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={8}
          style={styles.clearButton}
        >
          <View style={[styles.clearCircle, { backgroundColor: theme.textSecondary }]}>
            <Icon name="close" size={14} color={theme.backgroundElement} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  tone = "tint",
  style,
  ...props
}: PressableProps & { title: string; tone?: "tint" | "danger" | "plain" }) {
  const theme = useTheme();
  const background =
    tone === "tint" ? theme.tint : tone === "danger" ? theme.danger : theme.backgroundElement;
  const color = tone === "plain" ? theme.text : theme.onTint;
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        styles.button,
        { backgroundColor: background, opacity: state.pressed || props.disabled ? 0.6 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

/** A text button for headers ("Edit", "Save", "New"). */
export function HeaderButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={12}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={[styles.headerButton, { color: theme.tint }]}>{title}</Text>
    </Pressable>
  );
}

/** A small square button with an icon and a spoken label. */
export function IconButton({
  icon,
  a11y,
  onPress,
  disabled,
}: {
  icon: IconName;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={[styles.iconButton, { opacity: disabled ? 0.3 : 1 }]}
    >
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.empty}>
      <Label size="heading">{title}</Label>
      {message ? (
        <Label tone="secondary" style={styles.center}>
          {message}
        </Label>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: 600 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  sectionHeader: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: 500 },
  chipRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  field: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  iconPadding: { paddingLeft: 40 },
  leadingIcon: { position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center" },
  clearable: { justifyContent: "center" },
  clearablePadding: { paddingRight: 44 },
  clearButton: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  button: { paddingVertical: 13, paddingHorizontal: Spacing.three, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: 600, textAlign: "center" },
  headerButton: { fontSize: 16, fontWeight: 600 },
  iconButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: Spacing.two, padding: Spacing.five },
  center: { textAlign: "center" },
});
