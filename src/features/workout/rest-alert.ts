import * as Notifications from "expo-notifications";
import { AndroidAudioContentType, AndroidAudioUsage, AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import {
  DEFAULT_REST_ALERT,
  DEFAULT_REST_SOUND,
  REST_SOUNDS,
  type RestAlert,
  type RestSound,
} from "@/data/settings";

import { REST_SOUND_LABELS } from "./rest-sound";
import { restTimer, type RestTimer } from "./rest-timer";

/**
 * Local notifications for a workout:
 * - "Rest over": follows the rest timer (starting or adjusting reschedules it, stopping or skipping
 *   cancels it). It's an alarm-clock notification, so it rings on time with the screen locked or
 *   the app in the background, and it's shown while the app is open too so the sound plays.
 *   Sound and vibration come from its Android channel, one per Settings choice.
 * - "Still working out?": scheduled when the app leaves the screen with a workout running, and
 *   cancelled when it comes back.
 */
const VIBRATE_CHANNEL = "rest-vibrate";
/**
 * Android fixes a channel's sound when it's created, so each rest sound has its own channels:
 * sound with or without vibration, each in a normal and a "Ring even on silent" form (alarm
 * volume, like a kitchen timer). The files are bundled by the expo-notifications plugin
 * (app.config.ts), referred to by file name.
 */
const SOUND_FILES: Record<RestSound, string> = {
  beeps: "rest_over.wav",
  bell: "bell.wav",
  chime: "chime.wav",
  buzzer: "buzzer.wav",
};
type Audible = "both" | "sound";
export function restChannelId(sound: RestSound, kind: Audible, loud: boolean): string {
  return `rest-${sound}-${loud ? "alarm-" : ""}${kind}`;
}
const REMINDER_CHANNEL = "workout-reminder";
/** Channels from earlier versions (before per-sound channels); removed so they don't linger. */
const OLD_CHANNELS = [
  "rest-timer",
  "rest-both",
  "rest-sound",
  "rest-alarm-both",
  "rest-alarm-sound",
];
const VIBRATION = [0, 300, 150, 300];

/** How long the app must be away, with a workout running, before the reminder. */
export const REMINDER_AFTER_MS = 90 * 60 * 1000;

type Kind = "rest" | "reminder";

let mode: RestAlert = DEFAULT_REST_ALERT;
let ringOnSilent = true;
let sound: RestSound = DEFAULT_REST_SOUND;
/** Fixed ids, so a notification scheduled before the app was killed can still be cancelled. */
const REST_ID = "rest-over";
const REMINDER_ID = "workout-reminder";
let restScheduled = false;
let scheduledEnd = 0;
let ready: Promise<boolean> | null = null;
let installed = false;

/** Creates the channels and asks for notification permission (Android 13+ prompts once). */
export function prepareRestAlerts(): Promise<boolean> {
  ready ??= (async () => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          // Rest over shows (and sounds) in the app too; the reminder is only for when it's closed.
          const show = kindOf(notification.request.content.data) === "rest";
          return {
            shouldShowBanner: show,
            shouldShowList: show,
            // With "Ring even on silent" the app plays its own beep while open (rest-sound.ts).
            shouldPlaySound: show && !playsOwnSound(),
            shouldSetBadge: false,
          };
        },
      });
      if (Platform.OS === "android") {
        for (const id of OLD_CHANNELS) {
          await Notifications.deleteNotificationChannelAsync(id).catch(() => {});
        }
        const rest = {
          description: "Tells you when your rest between sets is over",
          importance: AndroidImportance.HIGH,
        };
        await Notifications.setNotificationChannelAsync(VIBRATE_CHANNEL, {
          ...rest,
          name: "Rest timer: vibration",
          sound: null,
          enableVibrate: true,
          vibrationPattern: VIBRATION,
        });
        const alarmAudio = {
          usage: AndroidAudioUsage.ALARM,
          contentType: AndroidAudioContentType.SONIFICATION,
          flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
        };
        for (const sound of REST_SOUNDS) {
          const label = REST_SOUND_LABELS[sound];
          for (const loud of [false, true]) {
            for (const kind of ["both", "sound"] as const) {
              const vibrate = kind === "both";
              await Notifications.setNotificationChannelAsync(restChannelId(sound, kind, loud), {
                ...rest,
                name: `Rest timer: ${label}${loud ? ", ring on silent" : ""}${vibrate ? ", with vibration" : ""}`,
                sound: SOUND_FILES[sound],
                ...(loud ? { audioAttributes: alarmAudio } : {}),
                enableVibrate: vibrate,
                ...(vibrate ? { vibrationPattern: VIBRATION } : {}),
              });
            }
          }
        }
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
          name: "Unfinished workout",
          description: "Reminds you about a workout left running",
          importance: AndroidImportance.DEFAULT,
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

/** Settings → Rest timer alert. Applies from the next rest (and reschedules a running one). */
export function setRestAlertMode(next: RestAlert) {
  if (next === mode) return;
  mode = next;
  queue(() => syncRest(restTimer.get()));
}

/**
 * True while a "Rest over" notification is scheduled, so the rest bar doesn't vibrate a second
 * time. With no permission (or Silent) nothing is scheduled; the bar's own vibration is the
 * fallback unless the choice is Silent or Sound.
 */
export function restAlertScheduled(): boolean {
  return restScheduled;
}

export function restAlertMode(): RestAlert {
  return mode;
}

/** Settings → "Ring even on silent". Applies from the next rest (and reschedules a running one). */
export function setRestRingOnSilent(next: boolean) {
  if (next === ringOnSilent) return;
  ringOnSilent = next;
  queue(() => syncRest(restTimer.get()));
}

/** While the app is open, it plays the beep itself when ring-on-silent applies to this mode. */
export function playsOwnSound(): boolean {
  return ringOnSilent && (mode === "both" || mode === "sound");
}

/** Settings → rest sound, for the notification. Applies from the next rest (and reschedules a running one). */
export function setRestAlertSound(next: RestSound) {
  if (next === sound) return;
  sound = next;
  queue(() => syncRest(restTimer.get()));
}

function restChannel(): string | undefined {
  if (mode === "silent") return undefined;
  if (mode === "vibrate") return VIBRATE_CHANNEL;
  return restChannelId(sound, mode, ringOnSilent);
}

export function kindOf(data: unknown): Kind | undefined {
  const kind = (data as { kind?: unknown } | null | undefined)?.kind;
  return kind === "rest" || kind === "reminder" ? kind : undefined;
}

async function cancel(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

async function syncRest(timer: RestTimer) {
  // A rest that ran out on its own: its notification is going off now, so leave it alone.
  const ranOut = !timer && restScheduled && scheduledEnd <= Date.now() + 500;
  restScheduled = false;
  if (ranOut) return;
  await cancel(REST_ID);
  const channelId = restChannel();
  if (!timer || !channelId || !(await prepareRestAlerts())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: REST_ID,
      content: {
        title: "Rest over",
        body: "Time for your next set.",
        sound: mode !== "vibrate",
        data: { kind: "rest" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: timer.endsAt,
        channelId,
        delivery: "alarmClock",
      },
    });
    restScheduled = true;
    scheduledEnd = timer.endsAt;
  } catch {
    restScheduled = false;
  }
}

// One change at a time, so quick −15/+15 taps can't leave an old notification scheduled.
let chain = Promise.resolve();
function queue(task: () => Promise<void>) {
  chain = chain.then(task, task);
}

/** Keeps the notification in step with the rest timer. Call once at startup. */
export function installRestAlerts() {
  if (installed) return;
  installed = true;
  restTimer.subscribe(() => {
    const timer = restTimer.get();
    queue(() => syncRest(timer));
  });
}

/** Schedules "Still working out?" for `REMINDER_AFTER_MS` from now (replacing any earlier one). */
export function scheduleWorkoutReminder(workoutName: string) {
  queue(async () => {
    await cancel(REMINDER_ID);
    if (!(await prepareRestAlerts())) return;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
          title: "Still working out?",
          body: `${workoutName} is still running. Tap to finish or discard it.`,
          data: { kind: "reminder" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: Date.now() + REMINDER_AFTER_MS,
          channelId: REMINDER_CHANNEL,
        },
      });
    } catch {
      // No alerts available: nothing to remind with.
    }
  });
}

export function cancelWorkoutReminder() {
  queue(() => cancel(REMINDER_ID));
}
