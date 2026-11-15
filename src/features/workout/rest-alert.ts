import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { restTimer, type RestTimer } from "./rest-timer";

/**
 * "Rest over" notification for when the app isn't on screen. It follows the rest timer: starting or
 * adjusting reschedules it, stopping or skipping cancels it. While the app is open the rest bar
 * vibrates instead, so the notification is not shown in the foreground.
 */
const CHANNEL = "rest-timer";
let scheduledId: string | null = null;
let ready: Promise<boolean> | null = null;
let installed = false;

/** Creates the channel and asks for notification permission (Android 13+ prompts once). */
export function prepareRestAlerts(): Promise<boolean> {
  ready ??= (async () => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: "Rest timer",
          description: "Tells you when your rest between sets is over",
          importance: AndroidImportance.HIGH,
          vibrationPattern: [0, 300, 150, 300],
        });
      }
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      return (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      // Native module missing (older dev build) or permission API unavailable: no alerts.
      return false;
    }
  })();
  return ready;
}

async function cancel() {
  const id = scheduledId;
  scheduledId = null;
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

async function sync(timer: RestTimer) {
  await cancel();
  if (!timer || !(await prepareRestAlerts())) return;
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: "Rest over", body: "Time for your next set." },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: timer.endsAt,
        channelId: CHANNEL,
        delivery: "alarmClock",
      },
    });
  } catch {
    scheduledId = null;
  }
}

/** Keeps the notification in step with the rest timer. Call once at startup. */
export function installRestAlerts() {
  if (installed) return;
  installed = true;
  // One change at a time, so quick −15/+15 taps can't leave an old notification scheduled.
  let queue = Promise.resolve();
  restTimer.subscribe(() => {
    const timer = restTimer.get();
    queue = queue.then(() => sync(timer));
  });
}
