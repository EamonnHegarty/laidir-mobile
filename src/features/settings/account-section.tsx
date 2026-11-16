import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet } from "react-native";

import { RowGroup } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Label, Row, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useSync } from "@/sync/sync-provider";
import type { SyncState } from "@/sync/controller";

/** Settings → Back up & sync: sign in, sync status, sync now, sign out. */
export function AccountSection() {
  const { state, controller } = useSync();
  const now = useMinuteClock();

  return (
    <>
      <SectionHeader>Back up & sync</SectionHeader>
      <RowGroup style={styles.group}>
        <Rows state={state} now={now} controller={controller} />
      </RowGroup>
      <Label tone="secondary" size="small" style={styles.note}>
        {note(state)}
      </Label>
    </>
  );
}

function Rows({
  state,
  now,
  controller,
}: {
  state: SyncState;
  now: number;
  controller: ReturnType<typeof useSync>["controller"];
}) {
  switch (state.kind) {
    case "loading":
      return <Row title="Back up & sync" right={<ActivityIndicator />} />;

    case "signing-in":
      return <Row title="Signing in…" right={<ActivityIndicator />} />;

    case "signed-out":
      return (
        <Row
          title="Sign in to back up"
          subtitle={state.message ?? "Keep your workouts safe and use them on another phone"}
          onPress={() => void controller.signIn()}
          right={<Icon name="login" />}
        />
      );

    case "mismatch":
      return (
        <>
          <Row
            title={`Signed in as ${state.account.email ?? "another account"}`}
            subtitle={`This phone's data belongs to ${state.existing.email ?? "a different account"}.`}
          />
          <Row
            title="Erase this phone's data and continue"
            subtitle="Downloads the new account's data instead"
            onPress={() => confirmErase(() => void controller.eraseAndContinue())}
            right={<Icon name="delete" />}
          />
          <Row
            title="Cancel"
            subtitle="Keep this phone's data and sign out"
            onPress={() => void controller.cancelMismatch()}
          />
        </>
      );

    case "signed-in":
      return (
        <>
          <Row
            title={state.account.email ?? "Signed in"}
            subtitle={status(state, now)}
            right={state.syncing ? <ActivityIndicator /> : <Icon name="cloud_done" />}
          />
          <Row
            title="Sync now"
            onPress={state.syncing ? undefined : () => void controller.syncNow({ force: true })}
            right={<Icon name="sync" />}
          />
          <Row
            title="Sign out"
            subtitle="Your data stays on this phone"
            onPress={() => confirmSignOut(() => void controller.signOut())}
            right={<Icon name="logout" />}
          />
        </>
      );
  }
}

function status(state: Extract<SyncState, { kind: "signed-in" }>, now: number): string {
  if (state.syncing) return "Syncing…";
  if (state.error) return state.error;
  const parts: string[] = [];
  parts.push(state.lastSyncedAt ? `Backed up ${ago(state.lastSyncedAt, now)}` : "Not synced yet");
  if (state.pending > 0) {
    parts.push(`${state.pending} change${state.pending === 1 ? "" : "s"} waiting`);
  }
  if (state.rejected > 0) {
    parts.push(`${state.rejected} item${state.rejected === 1 ? "" : "s"} couldn't sync`);
  }
  return parts.join(" · ");
}

function note(state: SyncState): string {
  if (state.kind === "signed-in") {
    return "Changes back up automatically when you're online. Láidir works fully offline too.";
  }
  if (state.kind === "mismatch") {
    return "A phone's data belongs to the first account that signs in on it.";
  }
  return "Optional. Without an account everything stays on this phone, and the app works the same.";
}

/** "just now", "5 min ago", "2 h ago", or a date. */
export function ago(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(then).toLocaleDateString();
}

function confirmSignOut(onConfirm: () => void) {
  Alert.alert(
    "Sign out?",
    "Your workouts stay on this phone but stop backing up until you sign in again.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: onConfirm },
    ],
  );
}

function confirmErase(onConfirm: () => void) {
  Alert.alert(
    "Erase this phone's data?",
    "Workouts, programs and exercises on this phone are deleted (they're still in the other " +
      "account if it was backed up). Appearance and colour are kept.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Erase", style: "destructive", onPress: onConfirm },
    ],
  );
}

/** Re-renders once a minute so "5 min ago" stays current. */
function useMinuteClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const styles = StyleSheet.create({
  group: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
