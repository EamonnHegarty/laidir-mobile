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
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant: VARIANT,
  },
});
