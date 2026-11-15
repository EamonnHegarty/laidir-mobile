import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DEFAULT_ACCENT } from "@/constants/theme";
import { DatabaseProvider, useLiveQuery } from "@/data/database-provider";
import { AccentContext, useTheme } from "@/hooks/use-theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <AccentProvider>
          <ThemedTabs />
        </AccentProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

/** Applies the accent colour picked in Settings to every screen (live, no restart). */
function AccentProvider({ children }: { children: React.ReactNode }) {
  const accent = useLiveQuery((r) => r.settings.accent(), []);
  return <AccentContext value={accent.data ?? DEFAULT_ACCENT}>{children}</AccentContext>;
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
