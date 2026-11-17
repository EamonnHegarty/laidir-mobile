import { ActivityIndicator, Alert, StyleSheet } from "react-native";

import { RowGroup } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Label, Row, SectionHeader } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { useSync } from "@/sync/sync-provider";
import type { SyncState } from "@/sync/controller";

/**
 * Settings → Back up & sync: sign in, a quiet "Backed up" (problems only when there are any), sign
 * out. Syncing itself is automatic and never needs a button.
 */
export function AccountSection() {
  const { state, controller } = useSync();

  return (
    <>
      <SectionHeader>Back up & sync</SectionHeader>
      <RowGroup style={styles.group}>
        <Rows state={state} controller={controller} />
      </RowGroup>
      <Label tone="secondary" size="small" style={styles.note}>
        {note(state)}
      </Label>
    </>
  );
}

function Rows({
  state,
  controller,
}: {
  state: SyncState;
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
            subtitle={status(state)}
            right={<Icon name={problem(state) ? "cloud_off" : "cloud_done"} />}
          />
          <Row
            title="Sign out"
            subtitle="Your data stays on this phone"
            onPress={() => confirmSignOut(() => void controller.signOut())}
            right={<Icon name="logout" />}
          />
          <Row
            title="Delete account"
            subtitle="Deletes your account and all your data"
            onPress={() => confirmDelete(() => deleteAccount(controller))}
            right={<Icon name="delete_forever" />}
          />
        </>
      );
  }
}

type SignedIn = Extract<SyncState, { kind: "signed-in" }>;

/** Something the user should know about; otherwise backing up stays invisible. */
function problem(state: SignedIn): string | undefined {
  if (state.error) return state.error;
  if (state.rejected > 0) {
    return `${state.rejected} item${state.rejected === 1 ? "" : "s"} couldn't be backed up`;
  }
  return undefined;
}

/** Quiet by design: "Backed up" unless there's a problem. */
function status(state: SignedIn): string {
  return problem(state) ?? "Backed up";
}

function note(state: SyncState): string {
  if (state.kind === "signed-in") {
    return "Everything backs up automatically. Pull down on this screen to check now.";
  }
  if (state.kind === "mismatch") {
    return "A phone's data belongs to the first account that signs in on it.";
  }
  return "Optional. Without an account everything stays on this phone, and the app works the same.";
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

/** Two steps, because it can't be undone. */
function confirmDelete(onConfirm: () => void) {
  Alert.alert(
    "Delete your account?",
    "This permanently deletes your Láidir account and everything backed up: workouts, programs, " +
      "custom exercises and settings. Workouts on this phone are erased too. Export a backup " +
      "first if you want to keep a copy.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () =>
          Alert.alert("Are you sure?", "Your account and data can't be recovered.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete account", style: "destructive", onPress: onConfirm },
          ]),
      },
    ],
  );
}

function deleteAccount(controller: ReturnType<typeof useSync>["controller"]) {
  controller.deleteAccount().catch((error: unknown) => {
    Alert.alert(
      "Couldn't delete your account",
      `${error instanceof Error ? error.message : String(error)}\n\nNothing was deleted on this phone. Check your connection and try again.`,
    );
  });
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

const styles = StyleSheet.create({
  group: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  note: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
});
