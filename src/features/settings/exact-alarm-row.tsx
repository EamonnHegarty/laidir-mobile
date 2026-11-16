import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import { Icon } from "@/components/icon";
import { Row } from "@/components/ui";
import { exactAlarmsAllowed, requestExactAlarms } from "@/features/workout/exact-alarm";

/** Settings → When rest is over: whether Android lets the alert ring exactly on time. */
export function ExactAlarmRow() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    void exactAlarmsAllowed().then(setAllowed);
  }, []);

  useEffect(() => {
    refresh();
    // The user may change it in system settings and come back.
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (Platform.OS !== "android" || allowed === null) return null;
  if (allowed) {
    return <Row title="Exact timing" subtitle="Allowed: rings right on time" />;
  }
  return (
    <Row
      title="Allow exact timing"
      subtitle="Off: the alert can be a few seconds late. Tap to allow alarms for Láidir."
      onPress={() => void requestExactAlarms().then(setAllowed)}
      right={<Icon name="alarm" />}
    />
  );
}
