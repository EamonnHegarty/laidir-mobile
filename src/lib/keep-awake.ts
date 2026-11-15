import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";

/**
 * Keeps the screen on while the calling screen is mounted. Does nothing (instead of crashing) when
 * the installed build doesn't have the native module yet.
 */
export function useScreenAwake(tag: string) {
  useEffect(() => {
    let active = false;
    try {
      activateKeepAwakeAsync(tag).then(
        () => {
          active = true;
        },
        () => {},
      );
    } catch {
      // Module missing: the screen just follows the normal timeout.
    }
    return () => {
      if (!active) return;
      try {
        deactivateKeepAwake(tag).catch(() => {});
      } catch {
        // Ignore: nothing to release.
      }
    };
  }, [tag]);
}
