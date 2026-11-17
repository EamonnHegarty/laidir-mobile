import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

/**
 * The "rest over" beep the app plays itself while it's open. It goes through the media volume,
 * which Android's silent mode doesn't mute (that's what "Ring even on silent" relies on), and it
 * ducks music for a moment instead of stopping it.
 */
let player: AudioPlayer | null = null;
let ready: Promise<void> | null = null;

function prepare(): Promise<void> {
  ready ??= (async () => {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers" });
    player = createAudioPlayer(require("../../../assets/sounds/rest-over.wav"));
  })().catch(() => {
    // Native module missing (older build) or audio unavailable: stay quiet.
    ready = null;
  });
  return ready;
}

export async function playRestSound(): Promise<void> {
  try {
    await prepare();
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // Never let a sound problem break the workout.
  }
}
