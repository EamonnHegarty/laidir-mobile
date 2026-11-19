import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useLiveQuery, useRepositories } from "@/data/database-provider";

import { exactAlarmsAllowed, promptForExactAlarms } from "./exact-alarm";
import {
  cancelWorkoutReminder,
  installRestAlerts,
  kindOf,
  scheduleWorkoutReminder,
  setRestAlertMode,
  setRestAlertSound,
  setRestRingOnSilent,
} from "./rest-alert";
import { setRestSound } from "./rest-sound";
import { restTimer } from "./rest-timer";
import { RestWatcher } from "./timers";

/**
 * What a workout needs while you're elsewhere, mounted once in the root layout:
 * - the rest timer ends (and stops) even when the workout screen isn't open;
 * - the "Rest over" sound/vibration choice from Settings;
 * - "Still working out?" scheduled when the app leaves the screen mid-workout (if on in Settings),
 *   and cancelled when it comes back;
 * - tapping either notification opens the workout.
 */
export function WorkoutBackground() {
  const query = useLiveQuery(async (r) => {
    const [active, restAlert, reminder, ringOnSilent, restSound] = await Promise.all([
      r.workouts.getActive(),
      r.settings.restAlert(),
      r.settings.workoutReminder(),
      r.settings.restRingOnSilent(),
      r.settings.restSound(),
    ]);
    return {
      active: active ? { name: active.name } : null,
      restAlert,
      reminder,
      ringOnSilent,
      restSound,
    };
  }, []);
  const state = useRef(query.data);
  useEffect(() => {
    state.current = query.data;
    if (query.data) {
      setRestAlertMode(query.data.restAlert);
      setRestRingOnSilent(query.data.ringOnSilent);
      setRestSound(query.data.restSound);
      setRestAlertSound(query.data.restSound);
    }
    if (query.data && (!query.data.active || !query.data.reminder)) cancelWorkoutReminder();
  }, [query.data]);

  useEffect(() => {
    installRestAlerts();
    const appState = AppState.addEventListener("change", (next) => {
      const current = state.current;
      if (next === "background" && current?.active && current.reminder) {
        scheduleWorkoutReminder(current.active.name);
      } else if (next === "active") {
        cancelWorkoutReminder();
      }
    });
    let responses: { remove: () => void } | undefined;
    try {
      responses = Notifications.addNotificationResponseReceivedListener((response) => {
        if (kindOf(response.notification.request.content.data) && state.current?.active) {
          router.navigate("/active");
        }
      });
    } catch {
      // Native module missing (older dev build).
    }
    return () => {
      appState.remove();
      responses?.remove();
    };
  }, []);

  useExactAlarmPrompt(query.data?.restAlert);

  return <RestWatcher />;
}

/**
 * The first time a rest starts with an audible/vibrating alert, if Android hasn't allowed exact
 * alarms, explain and offer to open the setting. Asked once per phone (Settings has it too).
 */
function useExactAlarmPrompt(restAlert: string | undefined) {
  const repos = useRepositories();
  const alert = useRef(restAlert);
  useEffect(() => {
    alert.current = restAlert;
  }, [restAlert]);
  useEffect(() => {
    let checking = false;
    return restTimer.subscribe(() => {
      if (checking || !restTimer.get() || !alert.current || alert.current === "silent") return;
      checking = true;
      void (async () => {
        try {
          if (await repos.settings.exactAlarmAsked()) return;
          if (await exactAlarmsAllowed()) return;
          promptForExactAlarms(() => void repos.settings.setExactAlarmAsked());
        } finally {
          checking = false;
        }
      })();
    });
  }, [repos]);
}
