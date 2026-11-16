import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Appearance, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DEFAULT_ACCENT } from "@/constants/theme";
import { DatabaseProvider, useLiveQuery } from "@/data/database-provider";
import { WorkoutBackground } from "@/features/workout/background";
import { AccentContext, useTheme } from "@/hooks/use-theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <AccentProvider>
          <ThemedTabs />
          <WorkoutBackground />
        </AccentProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Applies the accent colour and appearance (light / dark / system) picked in Settings to every
 * screen, live. Appearance overrides the app's colour scheme natively, so useColorScheme, the tab bar
 * and system dialogs all follow it.
 */
function AccentProvider({ children }: { children: React.ReactNode }) {
  const query = useLiveQuery(
    async (r) => ({ accent: await r.settings.accent(), appearance: await r.settings.appearance() }),
    [],
  );
  const appearance = query.data?.appearance;
  useEffect(() => {
    if (!appearance) return;
    try {
      Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
    } catch {
      // Not available (tests): keep following the phone.
    }
  }, [appearance]);
  return <AccentContext value={query.data?.accent ?? DEFAULT_ACCENT}>{children}</AccentContext>;
}

function ThemedTabs() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  // Stack headers, cards and back buttons pick these up.
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.tint,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  // The window background shows briefly behind screens and the keyboard; keep it on-theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  return (
    <ThemeProvider value={navigationTheme}>
      <NativeTabs
        backgroundColor={colors.background}
        indicatorColor={colors.doneRow}
        iconColor={{ default: colors.textSecondary, selected: colors.tint }}
        labelStyle={{
          default: { color: colors.textSecondary },
          selected: { color: colors.tint },
        }}
      >
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md="person" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history">
          <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md="history" />
        </NativeTabs.Trigger>
        {/* Programs is "/" (the (programs) group), so the app opens here. */}
        <NativeTabs.Trigger name="(programs)">
          <NativeTabs.Trigger.Label>Programs</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md="list_alt" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="exercises">
          <NativeTabs.Trigger.Label>Exercises</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md="exercise" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
