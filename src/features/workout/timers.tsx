import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { RestTimerView } from "@/data/settings";
import { useTheme } from "@/hooks/use-theme";
import { restOver } from "@/lib/haptics";
import { formatDuration } from "@/lib/units";

import { playsOwnSound, restAlertMode, restAlertScheduled } from "./rest-alert";
import { playRestSound } from "./rest-sound";
import { restTimer, type RestTimer, useRestTimer } from "./rest-timer";

/** The current time, refreshed every `ms` while mounted (read from state, so renders stay pure). */
export function useNow(ms: number): number {
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

/** Whole seconds left on the rest timer, refreshed four times a second; 0 when not resting. */
export function useRestLeft(): { timer: RestTimer; left: number } {
  const timer = useRestTimer();
  const now = useNow(250);
  return { timer, left: timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0 };
}

/**
 * Stops the rest timer when it runs out, wherever you are in the app, and vibrates if no "Rest over"
 * notification is doing it (no notification permission). Mounted once, in the root layout.
 */
export function RestWatcher() {
  const { timer, left } = useRestLeft();
  useEffect(() => {
    if (timer && left === 0) {
      // Check before stopping: stopping cancels (and forgets) the notification.
      const notified = restAlertScheduled();
      const mode = restAlertMode();
      restTimer.stop();
      if (!notified && (mode === "both" || mode === "vibrate")) restOver();
      // Ring even on silent: the app's own beep (the notification stays quiet while the app is open).
      if (playsOwnSound() && AppState.currentState === "active") void playRestSound();
    }
  }, [timer, left]);
  return null;
}

/**
 * The rest countdown, floating over the workout as a card (−15, +15, Skip) or as a small countdown
 * pill. Settings → "Rest timer opens as" picks which one each new rest starts as; the card's
 * minimise button and a tap on the pill switch between them for that rest.
 */
export function RestOverlay({ opensAs = "card" }: { opensAs?: RestTimerView }) {
  const { timer, left } = useRestLeft();
  const theme = useTheme();
  // The rest (by run number) the user switched away from its starting view.
  const [switchedRun, setSwitchedRun] = useState<number | null>(null);

  if (!timer || left === 0) return null;
  const progress = Math.min(1, left / timer.total);
  const switched = switchedRun === timer.run;
  const toggle = () => setSwitchedRun(switched ? null : timer.run);

  if ((opensAs === "icon") !== switched) {
    return (
      <View style={styles.pillWrap} pointerEvents="box-none">
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`Rest ${formatDuration(left)} left. Show rest timer`}
          style={({ pressed }) => [
            styles.pill,
            styles.shadow,
            { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Icon name="hourglass_top" size={18} color={theme.onTint} />
          <Text style={[styles.pillText, { color: theme.onTint }]}>{formatDuration(left)}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cardWrap} pointerEvents="box-none">
      <View
        style={[
          styles.card,
          styles.shadow,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}
      >
        <View style={styles.cardTop}>
          <Icon name="hourglass_top" size={22} color={theme.tint} />
          <Text
            style={[styles.time, { color: theme.text }]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Rest ${formatDuration(left)} left`}
          >
            {formatDuration(left)}
          </Text>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel="Minimise rest timer"
            hitSlop={10}
            style={({ pressed }) => [styles.minimise, pressed && { opacity: 0.5 }]}
          >
            <Icon name="close_fullscreen" size={20} />
          </Pressable>
        </View>
        <ProgressBar progress={progress} />
        <View style={styles.buttons}>
          <CardButton
            label="−15"
            a11y="Rest 15 seconds less"
            onPress={() => restTimer.adjust(-15)}
          />
          <CardButton
            label="+15"
            a11y="Rest 15 seconds more"
            onPress={() => restTimer.adjust(15)}
          />
          <CardButton label="Skip" a11y="Skip rest" filled onPress={() => restTimer.stop()} />
        </View>
      </View>
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

function CardButton({
  label,
  a11y,
  filled = false,
  onPress,
}: {
  label: string;
  a11y: string;
  filled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.cardButton,
        { backgroundColor: filled ? theme.tint : theme.control, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.cardButtonText, { color: filled ? theme.onTint : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three - 4,
  },
  shadow: {
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  time: { flex: 1, fontSize: 28, fontWeight: 700, fontVariant: ["tabular-nums"] },
  minimise: { padding: Spacing.one },
  buttons: { flexDirection: "row", gap: Spacing.two },
  cardButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 12,
  },
  cardButtonText: { fontSize: 16, fontWeight: 600 },
  pillWrap: { position: "absolute", right: Spacing.three, bottom: Spacing.three },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: { fontSize: 16, fontWeight: 700, fontVariant: ["tabular-nums"] },
  finish: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  finishText: { fontWeight: 600 },
});
