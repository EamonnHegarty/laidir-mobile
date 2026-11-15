import { Alert } from "react-native";

import type { Routine } from "@/data/contract";
import type { Repositories } from "@/data/index";

import { prepareRestAlerts } from "./rest-alert";
import { restTimer } from "./rest-timer";
import { defaultSessionName, sessionFromRoutine } from "./session";

/**
 * Starts a session (empty, or from a workout template) and opens it. If one is already in progress,
 * asks whether to resume it or discard it and start the new one.
 */
export async function startSession(
  repos: Repositories,
  openActive: () => void,
  routine?: Routine,
): Promise<void> {
  const begin = async () => {
    restTimer.stop();
    void prepareRestAlerts();
    await repos.workouts.start(
      routine
        ? { name: routine.name, routine_id: routine.id, exercises: sessionFromRoutine(routine) }
        : { name: defaultSessionName(new Date()) },
    );
    openActive();
  };

  const active = await repos.workouts.getActive();
  if (!active) return begin();

  Alert.alert("Workout in progress", `${active.name} is still going.`, [
    { text: "Resume it", onPress: openActive },
    {
      text: "Discard & start new",
      style: "destructive",
      onPress: async () => {
        await repos.workouts.remove(active.id);
        await begin();
      },
    },
    { text: "Cancel", style: "cancel" },
  ]);
}
