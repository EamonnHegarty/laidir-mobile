import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ProgressBar } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { restOver } from "@/lib/haptics";
import { formatDuration } from "@/lib/units";

import { restTimer, useRestTimer } from "./rest-timer";

/** The current time, refreshed every `ms` while mounted (read from state, so renders stay pure). */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "12:34" since the workout started. */
export function ElapsedTime({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return (
    <Label tone="secondary" accessibilityLabel={`Elapsed ${formatDuration(seconds)}`}>
      {formatDuration(seconds)}
    </Label>
  );
}

/**
 * Countdown bar shown while resting. Vibrates when the rest is over (while the app is open; a
 * notification when it's in the background needs a native module, so it isn't in v1).
 */
export function RestBar() {
  const timer = useRestTimer();
  const theme = useTheme();
  const now = useNow(250);
  const left = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (timer && left === 0) {
      restTimer.stop();
      restOver();
    }
  }, [timer, left]);

  if (!timer || left === 0) return null;
  const progress = Math.min(1, left / timer.total);

  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.barTop}>
        <Icon name="hourglass_top" size={22} color={theme.tint} />
        <Label size="heading" style={styles.time} accessibilityLiveRegion="polite">
          Rest {formatDuration(left)}
        </Label>
        <BarButton label="−15" a11y="Rest 15 seconds less" onPress={() => restTimer.adjust(-15)} />
        <BarButton label="+15" a11y="Rest 15 seconds more" onPress={() => restTimer.adjust(15)} />
        <BarButton label="Skip" a11y="Skip rest" onPress={() => restTimer.stop()} />
      </View>
      <ProgressBar progress={progress} />
    </View>
  );
}

/** The filled "Finish" button in the workout's header. */
export function FinishButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [
        styles.finish,
        { backgroundColor: theme.tint, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Label size="small" style={[styles.finishText, { color: theme.onTint }]}>
        Finish
      </Label>
    </Pressable>
  );
}

function BarButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      style={styles.button}
    >
      <Label tone="tint" size="heading">
        {label}
      </Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three - 4,
    paddingBottom: Spacing.three,
  },
  barTop: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  time: { flex: 1 },
  finish: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  finishText: { fontWeight: 600 },
  button: { paddingHorizontal: Spacing.one },
});
