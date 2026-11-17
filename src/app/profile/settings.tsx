import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Switch, View } from "react-native";

import { CommitField } from "@/components/commit-field";
import { RowGroup, Segmented } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Chip, ChipGrid, Label, Row, Screen, SectionHeader } from "@/components/ui";
import { PRIVACY_URL, SUPPORT_URL } from "@/constants/links";
import { type Appearance, APPEARANCES, Spacing } from "@/constants/theme";
import { CATALOGUE_VERSION } from "@/data/catalogue";
import { useLiveQuery, useRepositories } from "@/data/database-provider";
import { type RestAlert, REST_ALERTS, type Settings } from "@/data/settings";
import { AccentPicker } from "@/features/settings/accent-picker";
import { AccountSection } from "@/features/settings/account-section";
import { shareBackup } from "@/features/settings/backup";
import { ExactAlarmRow } from "@/features/settings/exact-alarm-row";
import { formatDuration } from "@/lib/units";
import { useSync } from "@/sync/sync-provider";

import contract from "../../../contract.json";

const REST_CHOICES = [60, 90, 120, 150, 180, 240, 300];
const APPEARANCE_LABELS: Record<Appearance, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
const REST_ALERT_LABELS: Record<RestAlert, string> = {
  both: "Sound + vibration",
  sound: "Sound",
  vibrate: "Vibration",
  silent: "Silent",
};

export default function SettingsScreen() {
  const repos = useRepositories();
  const [exporting, setExporting] = useState(false);
  const query = useLiveQuery(async (r) => {
    const [settings, displayName, accent, appearance, restAlert, reminder, ringOnSilent] =
      await Promise.all([
        r.settings.get(),
        r.settings.displayName(),
        r.settings.accent(),
        r.settings.appearance(),
        r.settings.restAlert(),
        r.settings.workoutReminder(),
        r.settings.restRingOnSilent(),
      ]);
    return { settings, displayName, accent, appearance, restAlert, reminder, ringOnSilent };
  }, []);
  const update = (changes: Partial<Settings>) => void repos.settings.update(changes);
  const { controller: sync } = useSync();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await sync.syncNow({ force: true });
    } finally {
      setRefreshing(false);
    }
  };
  const variant = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant;

  const exportBackup = async () => {
    setExporting(true);
    try {
      await shareBackup(repos);
    } catch (error) {
      Alert.alert("Couldn't export", error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  if (!query.data) return <Screen />;
  const { settings, displayName, accent, appearance, restAlert, reminder, ringOnSilent } =
    query.data;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          // Pull down to back up now (when signed in). Syncing is otherwise automatic.
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
      >
        <AccountSection />

        <SectionHeader>Profile</SectionHeader>
        <View style={styles.pad}>
          <CommitField
            value={displayName ?? ""}
            commit={(text) => {
              if ([...text.trim()].length > 50) return false;
              void repos.settings.setDisplayName(text);
              return true;
            }}
            placeholder="Your name"
            accessibilityLabel="Display name"
            maxLength={50}
            autoCapitalize="words"
          />
        </View>

        <SectionHeader>Appearance</SectionHeader>
        <View style={styles.pad}>
          <Segmented
            options={APPEARANCES}
            value={appearance}
            labels={APPEARANCE_LABELS}
            onChange={(next) => void repos.settings.setAppearance(next)}
          />
        </View>

        <SectionHeader>Accent colour</SectionHeader>
        <View style={styles.pad}>
          <AccentPicker value={accent} onChange={(next) => void repos.settings.setAccent(next)} />
        </View>
        <Label tone="secondary" size="small" style={styles.note}>
          Buttons, done sets, charts and the tab bar. Appearance and colour are kept on this phone
          only.
        </Label>

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

        <SectionHeader>Rest timer</SectionHeader>
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
          The default between sets, when a workout or exercise doesn&apos;t set its own. Weights are
          always stored in kg, so switching units never changes your history.
        </Label>

        <SectionHeader>When rest is over</SectionHeader>
        <Choice>
          {REST_ALERTS.map((alert) => (
            <Chip
              key={alert}
              label={REST_ALERT_LABELS[alert]}
              selected={restAlert === alert}
              onPress={() => void repos.settings.setRestAlert(alert)}
            />
          ))}
        </Choice>
        <RowGroup style={styles.group}>
          {restAlert === "both" || restAlert === "sound" ? (
            <Row
              title="Ring even on silent"
              subtitle="Like a timer: uses the alarm/media volume when the phone is on silent"
              onPress={() => void repos.settings.setRestRingOnSilent(!ringOnSilent)}
              right={
                <Switch
                  value={ringOnSilent}
                  onValueChange={(on) => void repos.settings.setRestRingOnSilent(on)}
                  accessibilityLabel="Ring even on silent"
                />
              }
            />
          ) : null}
          <ExactAlarmRow />
        </RowGroup>
        <Label tone="secondary" size="small" style={styles.note}>
          Rings with the screen locked or the app in the background too. Each exercise&apos;s rest
          is set from the timer chip on its card during a workout.
        </Label>

        <SectionHeader>Unfinished workout</SectionHeader>
        <RowGroup style={styles.group}>
          <Row
            title="Remind me"
            subtitle="If a workout is left running with the app closed for 90 minutes"
            onPress={() => void repos.settings.setWorkoutReminder(!reminder)}
            right={
              <Switch
                value={reminder}
                onValueChange={(on) => void repos.settings.setWorkoutReminder(on)}
                accessibilityLabel="Remind me about an unfinished workout"
              />
            }
          />
        </RowGroup>

        <SectionHeader>Data</SectionHeader>
        <RowGroup style={styles.group}>
          <Row
            title={exporting ? "Exporting…" : "Download my data (JSON)"}
            subtitle="All your workouts, programs, exercises and settings, as one file to save or send"
            onPress={exporting ? undefined : () => void exportBackup()}
            right={<Icon name="ios_share" />}
          />
        </RowGroup>

        <SectionHeader>About</SectionHeader>
        <RowGroup style={styles.group}>
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
          <Row
            title="Privacy policy"
            onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
            right={<Icon name="open_in_new" />}
          />
          <Row
            title="Help & support"
            onPress={() => void WebBrowser.openBrowserAsync(SUPPORT_URL)}
            right={<Icon name="open_in_new" />}
          />
        </RowGroup>
        <Label tone="secondary" size="small" style={styles.note}>
          Everything is stored on this phone first. Signed in, it also backs up to Láidir&apos;s
          servers in the EU (Ireland).
        </Label>
      </ScrollView>
    </Screen>
  );
}

function Choice({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pad}>
      <ChipGrid>{children}</ChipGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.five * 2 },
  pad: { paddingHorizontal: Spacing.three },
  group: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
