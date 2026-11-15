import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";
import { DatabaseProvider } from "@/data/database-provider";

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = Colors[scheme];

  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <DatabaseProvider>
        <NativeTabs
          backgroundColor={colors.background}
          indicatorColor={colors.backgroundElement}
          labelStyle={{ selected: { color: colors.text } }}
        >
          <NativeTabs.Trigger name="index">
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
