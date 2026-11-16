// "Glas v2" building blocks: raised cards, stat tiles, pills, a segmented control and a progress
// bar. Green (tint) is kept for done / active / PR; everything else is grey.
import type { ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { Icon, type IconName } from "./icon";
import { Label } from "./ui";

export const RADIUS = 12;

/** A tab's own title row (the tab screens hide the native header for this). */
export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.pageHeader, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.flex}>
        <Label size="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Label>
        {subtitle ? (
          <Label tone="secondary" size="small">
            {subtitle}
          </Label>
        ) : null}
      </View>
      {right ? <View style={styles.headerActions}>{right}</View> : null}
    </View>
  );
}

/** A round icon button for headers and cards. `label` is what screen readers say. */
export function IconAction({
  icon,
  label,
  onPress,
  tone = "secondary",
  size = 24,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "secondary" | "tint";
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconAction, pressed && { opacity: 0.5 }]}
    >
      <Icon name={icon} size={size} color={tone === "tint" ? theme.tint : theme.textSecondary} />
    </Pressable>
  );
}

/** A raised card. `active` is the green-tinted variant (in progress, highlights). */
export function Card({
  children,
  onPress,
  onLongPress,
  active,
  style,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const base = [
    styles.card,
    { backgroundColor: active ? theme.doneRow : theme.backgroundElement },
    style,
  ];
  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && { opacity: 0.75 }]}
    >
      {children}
    </Pressable>
  );
}

/** Rows (from `Row`) grouped on one card; the last row's divider is hidden. */
export function RowGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.rowGroup, { backgroundColor: theme.backgroundElement }, style]}>
      <View style={styles.rowGroupInner}>{children}</View>
    </View>
  );
}

/** A dashed-outline action, for "add" and "start empty" style buttons. */
export function DashedButton({
  title,
  icon = "add",
  onPress,
  style,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.dashed,
        { borderColor: theme.border },
        pressed && { backgroundColor: theme.backgroundElement },
        style,
      ]}
    >
      <Icon name={icon} size={20} color={theme.tint} />
      <Text style={[styles.dashedText, { color: theme.tint }]}>{title}</Text>
    </Pressable>
  );
}

/** A number with a small label above it. Lay several out with `StatTiles`. */
export function StatTile({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: string;
  accent?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: theme.backgroundElement }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          compact ? styles.tileValueCompact : styles.tileValue,
          { color: accent ? theme.tint : theme.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export function StatTiles({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

/** A small rounded label. `accent` = green (done, PR, next up); otherwise grey. */
export function Pill({
  label,
  icon,
  tone = "neutral",
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  tone?: "accent" | "neutral";
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const color = tone === "accent" ? theme.tint : theme.textSecondary;
  const body = (
    <>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const style = [
    styles.pill,
    { backgroundColor: tone === "accent" ? theme.doneRow : theme.control },
  ];
  if (!onPress) {
    return (
      <View style={style} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    >
      {body}
    </Pressable>
  );
}

export function PillRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.pillRow, style]}>{children}</View>;
}

/** Equal-width options in a row, one selected (e.g. 1M · 3M · 6M · 1Y · All). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  const theme = useTheme();
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              { backgroundColor: selected ? theme.doneRow : theme.backgroundElement },
            ]}
          >
            <Text
              style={[styles.segmentText, { color: selected ? theme.tint : theme.textSecondary }]}
            >
              {labels?.[option] ?? option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A thin bar filled to `progress` (0–1). */
export function ProgressBar({
  progress,
  style,
}: {
  progress: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` as const;
  return (
    <View style={[styles.track, { backgroundColor: theme.control }, style]}>
      <View style={[styles.fill, { backgroundColor: theme.tint, width }]} />
    </View>
  );
}

/** Card title on the left, a small note or control on the right. */
export function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.cardHeader}>
      <Label style={styles.flex} numberOfLines={1}>
        {title}
      </Label>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  iconAction: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: RADIUS, padding: Spacing.three - 4, gap: Spacing.one },
  rowGroup: { borderRadius: RADIUS, overflow: "hidden" },
  rowGroupInner: { marginBottom: -StyleSheet.hairlineWidth },
  dashed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS,
    paddingVertical: 12,
  },
  dashedText: { fontSize: 16, fontWeight: 600 },
  tiles: { flexDirection: "row", gap: Spacing.two },
  tile: { flex: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, minWidth: 0 },
  tileLabel: { fontSize: 12, lineHeight: 16 },
  tileValue: { fontSize: 20, lineHeight: 26, fontWeight: 600 },
  tileValueCompact: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segmented: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  segmentText: { fontSize: 14, fontWeight: 500 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
});
