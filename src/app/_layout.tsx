import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";
import { DatabaseProvider } from "@/data/database-provider";

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = Colors[scheme];
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
      <DatabaseProvider>
        <NativeTabs
          backgroundColor={colors.background}
          indicatorColor={colors.doneRow}
          iconColor={{ default: colors.textSecondary, selected: colors.tint }}
          labelStyle={{
            default: { color: colors.textSecondary },
            selected: { color: colors.tint },
          }}
        >
          <NativeTabs.Trigger name="(workout)">
            <NativeTabs.Trigger.Label>Workout</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon md="fitness_center" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="history">
            <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon md="history" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="routines">
            <NativeTabs.Trigger.Label>Programs</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon md="list_alt" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="exercises">
            <NativeTabs.Trigger.Label>Exercises</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon md="exercise" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon md="settings" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
