import * as Haptics from "expo-haptics";

/**
 * Haptic feedback that never gets in the way: if the native module isn't in the installed build, or
 * the device has haptics off, it does nothing instead of throwing.
 */
function safely(run: () => Promise<void>) {
  try {
    run().catch(() => {});
  } catch {
    // Native module missing (e.g. an older dev build): skip the vibration.
  }
}

/** A set was ticked off. */
export const tapConfirm = () =>
  safely(() => Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm));

/** The rest timer finished. */
export const restOver = () =>
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
