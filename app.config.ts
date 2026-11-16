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
  // Phase 3 Cognito redirect URIs are laidir://auth/callback and laidir://auth/logout.
  scheme: "laidir",
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
    // deferring it for battery saving. USE_EXACT_ALARM is granted without a prompt (sideloaded app).
    permissions: ["android.permission.USE_EXACT_ALARM"],
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
        // Local notifications only (rest timer); no push until sync exists.
        enableRemoteNotifications: false,
      },
    ],
  ],
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
