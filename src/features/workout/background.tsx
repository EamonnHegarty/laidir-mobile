import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useLiveQuery } from "@/data/database-provider";

import {
  cancelWorkoutReminder,
  installRestAlerts,
  kindOf,
  scheduleWorkoutReminder,
  setRestAlertMode,
} from "./rest-alert";
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
    const [active, restAlert, reminder] = await Promise.all([
      r.workouts.getActive(),
      r.settings.restAlert(),
      r.settings.workoutReminder(),
    ]);
    return { active: active ? { name: active.name } : null, restAlert, reminder };
  }, []);
  const state = useRef(query.data);
  useEffect(() => {
    state.current = query.data;
    if (query.data) setRestAlertMode(query.data.restAlert);
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

  return <RestWatcher />;
}
