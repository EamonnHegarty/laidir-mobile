import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useLiveQuery } from "@/data/database-provider";
import { useTheme } from "@/hooks/use-theme";
import { formatDuration } from "@/lib/units";

import { ElapsedTime, useRestLeft } from "./timers";

/**
 * "Back to workout": a card pinned above the tab bar on the other tabs while a workout is running,
 * with its elapsed time and the rest countdown. Tapping it opens the workout.
 */
export function WorkoutBanner() {
  const router = useRouter();
  const theme = useTheme();
  const query = useLiveQuery(async (r) => {
    const active = await r.workouts.getActive();
    return active ? { name: active.name, started_at: active.started_at } : null;
  }, []);
  const { left } = useRestLeft();
  const active = query.data;
  if (!active) return null;

  return (
    <Pressable
      onPress={() => router.navigate("/active")}
      accessibilityRole="button"
      accessibilityLabel={`Back to workout: ${active.name}${left > 0 ? `, rest ${formatDuration(left)} left` : ""}`}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: theme.backgroundElement, borderColor: theme.tint },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Icon name="fitness_center" size={22} color={theme.tint} />
      <View style={styles.flex}>
        <Label size="small" tone="tint" numberOfLines={1}>
          Back to workout
        </Label>
        <View style={styles.meta}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {active.name}
          </Text>
          <ElapsedTime startedAt={active.started_at} />
        </View>
      </View>
      {left > 0 ? (
        <View style={[styles.rest, { backgroundColor: theme.tint }]}>
          <Icon name="hourglass_top" size={16} color={theme.onTint} />
          <Text style={[styles.restText, { color: theme.onTint }]}>{formatDuration(left)}</Text>
        </View>
      ) : null}
      <Icon name="chevron_right" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + 4,
    marginHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: 14,
    borderWidth: 1,
  },
  flex: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  name: { flexShrink: 1, fontSize: 15, fontWeight: 600 },
  rest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  restText: { fontSize: 14, fontWeight: 700, fontVariant: ["tabular-nums"] },
});

/** A tab's stack with the back-to-workout banner under it (above the tab bar). */
export function WithWorkoutBanner({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[wrap.root, { backgroundColor: theme.background }]}>
      <View style={wrap.root}>{children}</View>
      <WorkoutBanner />
    </View>
  );
}

const wrap = StyleSheet.create({ root: { flex: 1 } });
