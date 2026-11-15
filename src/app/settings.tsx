import Constants from "expo-constants";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip, ChipGrid, Label, Row, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { CATALOGUE_VERSION } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import type { Settings } from "@/data/settings";
import { useTheme } from "@/hooks/use-theme";
import { formatDuration } from "@/lib/units";

import contract from "../../contract.json";

const REST_CHOICES = [60, 90, 120, 150, 180, 240, 300];

export default function SettingsScreen() {
  const theme = useTheme();
  const repos = useRepositories();
  const query = useLiveQuery((r) => r.settings.get(), []);
  const settings = query.data;
  const update = (changes: Partial<Settings>) => void repos.settings.update(changes);
  const variant = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Label size="title" accessibilityRole="header" style={styles.title}>
          Settings
        </Label>

        {settings ? (
          <>
            <SectionHeader>Weight</SectionHeader>
            <Choice>
              <Chip
                label="Kilograms (kg)"
                selected={settings.weight_unit === "kg"}
                onPress={() => update({ weight_unit: "kg" })}
              />
              <Chip
                label="Pounds (lb)"
                selected={settings.weight_unit === "lb"}
                onPress={() => update({ weight_unit: "lb" })}
              />
            </Choice>

            <SectionHeader>Distance</SectionHeader>
            <Choice>
              <Chip
                label="Kilometres"
                selected={settings.distance_unit === "km"}
                onPress={() => update({ distance_unit: "km" })}
              />
              <Chip
                label="Miles"
                selected={settings.distance_unit === "mi"}
                onPress={() => update({ distance_unit: "mi" })}
              />
            </Choice>

            <SectionHeader>Default rest between sets</SectionHeader>
            <Choice>
              {REST_CHOICES.map((seconds) => (
                <Chip
                  key={seconds}
                  label={formatDuration(seconds)}
                  selected={settings.default_rest_seconds === seconds}
                  onPress={() => update({ default_rest_seconds: seconds })}
                />
              ))}
            </Choice>
            <Label tone="secondary" size="small" style={styles.note}>
              Used when a workout doesn&apos;t set its own rest time. Weights are always stored in
              kg, so switching units never changes your history.
            </Label>
          </>
        ) : null}

        <SectionHeader>About</SectionHeader>
        <Row
          title="Version"
          right={
            <Label tone="secondary">
              {Constants.expoConfig?.version ?? "?"}
              {variant === "development" ? " (dev)" : ""}
            </Label>
          }
        />
        <Row
          title="Exercise catalogue"
          right={<Label tone="secondary">v{CATALOGUE_VERSION}</Label>}
        />
        <Row
          title="Data contract"
          right={<Label tone="secondary">laidir-api {contract.ref.slice(0, 7)}</Label>}
        />
        <Label tone="secondary" size="small" style={styles.note}>
          Everything is stored on this phone. Backup and sync across devices come later.
        </Label>
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.choice}>
      <ChipGrid>{children}</ChipGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: Spacing.five * 2 },
  title: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
  choice: { paddingHorizontal: Spacing.three },
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
