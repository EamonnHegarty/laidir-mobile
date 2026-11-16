import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";

/**
 * "Rest over" is an alarm-clock notification, which needs Android's exact-alarm permission
 * (SCHEDULE_EXACT_ALARM). Android 14+ leaves it off for new installs until the user allows it in
 * system settings. Without it the alert still comes, just possibly a few seconds late.
 */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    // Older native build without the API: nothing to ask for.
    return true;
  }
}

/** Opens the system screen to allow exact alarms; resolves when the user comes back. */
export async function requestExactAlarms(): Promise<boolean> {
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return exactAlarmsAllowed();
  }
}

/** Asks once (explains first, then opens system settings if the user agrees). */
export function promptForExactAlarms(onAnswered: () => void): void {
  Alert.alert(
    "Rest alerts on time",
    "To ring exactly when your rest is over (even with the screen locked), Android needs you to " +
      "allow alarms for Láidir. Without it the alert can be a few seconds late.",
    [
      { text: "Not now", style: "cancel", onPress: onAnswered },
      {
        text: "Allow",
        onPress: () => {
          onAnswered();
          void requestExactAlarms();
        },
      },
    ],
    { cancelable: true, onDismiss: onAnswered },
  );
}
