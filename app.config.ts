import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Build variants, chosen by APP_VARIANT (set per profile in eas.json):
 * - development: dev client (hot reload from `pnpm start`), installs alongside the real app.
 * - preview (default): standalone APK for daily use, fully offline.
 *
 * The Android package can't change after the first install without a reinstall.
 */
const VARIANT = process.env.APP_VARIANT === "development" ? "development" : "preview";
const IS_DEV = VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "Láidir (dev)" : "Láidir",
  slug: "laidir-mobile",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // Cognito redirects to laidir://auth/callback and laidir://auth/logout (registered on the mobile
  // client). The dev client gets its own scheme so the two apps never compete for those links (an
  // Android "open with" chooser mid-sign-in); signing in from the dev client needs laidir-dev://
  // callbacks added in laidir-infra first.
  scheme: IS_DEV ? "laidir-dev" : "laidir",
  userInterfaceStyle: "automatic",
  platforms: ["android"],
  android: {
    package: IS_DEV ? "ie.eamonnhegarty.laidir.dev" : "ie.eamonnhegarty.laidir",
    // Icons come from scripts/make-icons.mjs (pnpm icons); colours match Brand in src/constants/theme.ts.
    adaptiveIcon: {
      backgroundColor: "#0E1A14",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // The rest-timer alert is an alarm-clock notification so Android delivers it on time instead of
    // deferring it for battery saving. That needs SCHEDULE_EXACT_ALARM, which Android 14+ leaves off
    // until the user allows it (Settings → Rest timer). USE_EXACT_ALARM is auto-granted but Google
    // Play restricts it to alarm/timer/calendar apps, so it's blocked even if a library adds it.
    // Without the grant the alert still arrives, possibly a little late.
    permissions: ["android.permission.SCHEDULE_EXACT_ALARM"],
    // Blocked even if a library or Expo's defaults add them (each one is a Play review question):
    // - RECORD_AUDIO: expo-audio only plays the rest beep; a gym app never needs the mic.
    // - Storage: backups go out through the share sheet (app cache + FileProvider), no storage access.
    // - SYSTEM_ALERT_WINDOW: only the dev client's dev menu uses it.
    blockedPermissions: [
      "android.permission.USE_EXACT_ALARM",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      ...(IS_DEV ? [] : ["android.permission.SYSTEM_ALERT_WINDOW"]),
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#111214",
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#3DDC84",
        // Local notifications only (rest timer). No push yet.
        enableRemoteNotifications: false,
        // Rest-over sounds for the notification channels (Android needs res/raw-safe names).
        sounds: [
          "./assets/sounds/rest_over.wav",
          "./assets/sounds/bell.wav",
          "./assets/sounds/chime.wav",
          "./assets/sounds/buzzer.wav",
        ],
      },
    ],
    // Phase 3 sign-in: Cognito managed login in the system browser (expo-auth-session), tokens in
    // the Android Keystore-backed store (excluded from Auto Backup by the plugin).
    "expo-web-browser",
    "expo-secure-store",
    // Plays the "rest over" beep while the app is open (media volume, so silent mode doesn't mute
    // it). No recording, and no background playback (that would need a foreground-service
    // permission Play asks you to justify).
    ["expo-audio", { recordAudioAndroid: false, enableBackgroundPlayback: false }],
  ],
  // EAS Update: JS-only changes ship over the air (eas update --channel preview) without a new build.
  // The fingerprint policy changes the runtime version whenever native code changes, so an update
  // can never reach a build it isn't compatible with.
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    url: "https://u.expo.dev/da82ec53-fc13-49cf-97a9-9864e7969fed",
    // Download in the background on launch; the new JS applies on the next launch.
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  // EAS project @eamonnhegarty/laidir-mobile (not a secret). Both variants build under it.
  owner: "eamonnhegarty",
  extra: {
    variant: VARIANT,
    eas: {
      projectId: "da82ec53-fc13-49cf-97a9-9864e7969fed",
    },
  },
});
