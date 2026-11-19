import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { DEFAULT_REST_SOUND, type RestSound } from "@/data/settings";

/**
 * The "rest over" sound the app plays itself while it's open. It goes through the media volume,
 * which Android's silent mode doesn't mute (that's what "Ring even on silent" relies on), and it
 * ducks music for a moment instead of stopping it. Sounds are made by scripts/make-sounds.mjs.
 */
const SOURCES: Record<RestSound, number> = {
  beeps: require("../../../assets/sounds/rest_over.wav") as number,
  bell: require("../../../assets/sounds/bell.wav") as number,
  chime: require("../../../assets/sounds/chime.wav") as number,
  buzzer: require("../../../assets/sounds/buzzer.wav") as number,
};

export const REST_SOUND_LABELS: Record<RestSound, string> = {
  beeps: "Beeps",
  bell: "Boxing bell",
  chime: "Chime",
  buzzer: "Buzzer",
};

let chosen: RestSound = DEFAULT_REST_SOUND;
const players = new Map<RestSound, AudioPlayer>();
let audioMode: Promise<void> | null = null;

/** Settings → rest sound. Applies to the next rest. */
export function setRestSound(sound: RestSound) {
  chosen = sound;
}

function player(sound: RestSound): AudioPlayer {
  let p = players.get(sound);
  if (!p) {
    p = createAudioPlayer(SOURCES[sound]);
    players.set(sound, p);
  }
  return p;
}

/** Plays the chosen sound, or `sound` (Settings previews a choice). Never throws. */
export async function playRestSound(sound: RestSound = chosen): Promise<void> {
  try {
    audioMode ??= setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    }).catch((error: unknown) => {
      audioMode = null;
      throw error;
    });
    await audioMode;
    // Stop any other sound still ringing (e.g. a preview of the bell) first.
    for (const [name, other] of players) if (name !== sound) other.pause();
    const p = player(sound);
    await p.seekTo(0);
    p.play();
  } catch {
    // Native module missing (older build) or audio unavailable: never let a sound break a workout.
  }
}
