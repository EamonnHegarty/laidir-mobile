// Small, theme-coloured charts drawn with react-native-svg. They size to their container's width.
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect } from "react-native-svg";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  return { width, onLayout };
}

/** Labels under a chart: first, middle and last. */
function AxisLabels({ labels }: { labels: readonly string[] }) {
  const theme = useTheme();
  if (labels.length === 0) return null;
  const picks =
    labels.length < 3
      ? labels
      : [labels[0]!, labels[Math.floor(labels.length / 2)]!, labels.at(-1)!];
  return (
    <View style={styles.axis} importantForAccessibility="no-hide-descendants">
      {picks.map((label, i) => (
        <Text key={i} style={[styles.axisText, { color: theme.textSecondary }]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

/** Vertical bars. `fadeLast` dims the last bar (the current, unfinished week or month). */
export function BarChart({
  values,
  labels = [],
  height = 90,
  fadeLast,
  accessibilityLabel,
}: {
  values: readonly number[];
  labels?: readonly string[];
  height?: number;
  fadeLast?: boolean;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const max = Math.max(1, ...values);
  const slot = values.length > 0 ? width / values.length : 0;
  const bar = Math.max(2, Math.min(28, slot * 0.62));
  const radius = Math.min(4, bar / 2);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {values.map((v, i) => {
            const h = v === 0 ? 0 : Math.max(3, (v / max) * (height - 4));
            return (
              <Rect
                key={i}
                x={i * slot + (slot - bar) / 2}
                y={height - 1 - h}
                width={bar}
                height={h}
                rx={radius}
                fill={theme.tint}
                opacity={fadeLast && i === values.length - 1 ? 0.45 : 1}
              />
            );
          })}
          <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={theme.border} />
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <AxisLabels labels={labels} />
    </View>
  );
}

/**
 * A line through the values (nulls are skipped). `marks` are indexes to draw a dot on, e.g. PRs;
 * the last point always gets one.
 */
export function LineChart({
  values,
  labels = [],
  height = 80,
  marks = [],
  accessibilityLabel,
}: {
  values: readonly (number | null)[];
  labels?: readonly string[];
  height?: number;
  marks?: readonly number[];
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const present = values.filter((v): v is number => v !== null);
  const min = present.length > 0 ? Math.min(...present) : 0;
  const max = present.length > 0 ? Math.max(...present) : 1;
  const span = max - min || Math.max(1, max * 0.1);
  const pad = 6;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const x = (i: number) => (values.length > 1 ? pad + i * step : width / 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const points = values
    .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const lastIndex = values.findLastIndex((v) => v !== null);
  const dots = new Set([...marks, ...(lastIndex >= 0 ? [lastIndex] : [])]);

  return (
    <View accessible accessibilityLabel={accessibilityLabel} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke={theme.border} />
          {present.length > 1 ? (
            <Polyline
              points={points}
              fill="none"
              stroke={theme.tint}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {[...dots].map((i) => {
            const v = values[i];
            return v === null || v === undefined ? null : (
              <Circle key={i} cx={x(i)} cy={y(v)} r={4} fill={theme.tint} />
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <AxisLabels labels={labels} />
    </View>
  );
}

/** Labelled horizontal bars with the value on the right, longest first as given. */
export function HBarList({ items }: { items: readonly { label: string; value: number }[] }) {
  const theme = useTheme();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={styles.hbars}>
      {items.map((item) => (
        <View
          key={item.label}
          style={styles.hbar}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}`}
        >
          <Text style={[styles.hbarLabel, { color: theme.text }]} numberOfLines={1}>
            {item.label}
          </Text>
          <View style={styles.hbarTrack}>
            {item.value > 0 ? (
              <View
                style={[
                  styles.hbarFill,
                  { backgroundColor: theme.tint, width: `${(item.value / max) * 100}%` },
                ]}
              />
            ) : null}
          </View>
          <Text style={[styles.hbarValue, { color: theme.textSecondary }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisText: { fontSize: 11, lineHeight: 14 },
  hbars: { gap: Spacing.two, marginTop: Spacing.one },
  hbar: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  hbarLabel: { width: 76, fontSize: 13 },
  hbarTrack: { flex: 1, height: 8 },
  hbarFill: { height: 8, borderRadius: 4 },
  hbarValue: { width: 32, fontSize: 12, textAlign: "right" },
});
