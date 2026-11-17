import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { Routine, RoutineFolder } from "@/data/contract";
import { useRepositories } from "@/data/database-provider";
import { useTheme } from "@/hooks/use-theme";

import { MoveSheet } from "./move-sheet";

const TOAST_MS = 5000;

type Toast = { text: string; undo: () => void };

/**
 * "Move to…" for workouts: `open(routine)` shows the sheet; after a move a toast says where it went
 * and offers Undo for a few seconds. Render `sheet` and `toast` in the screen.
 */
export function useMoveWorkout() {
  const repos = useRepositories();
  const [target, setTarget] = useState<Routine | null>(null);
  const [folders, setFolders] = useState<RoutineFolder[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = (next: Toast | null) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(next);
    if (next) timer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const fail = (error: unknown) =>
    Alert.alert("Couldn't move it", error instanceof Error ? error.message : String(error));

  const moveTo = async (routine: Routine, folderId: string | undefined, folderName: string) => {
    try {
      const before = await repos.routines.move(routine.id, folderId);
      show({
        text: `Moved ${routine.name} to ${folderName}`,
        undo: () => {
          show(null);
          repos.routines.place(routine.id, before).catch(fail);
        },
      });
    } catch (error) {
      fail(error);
    }
  };

  const open = (routine: Routine) => {
    repos.routines
      .listFolders()
      .then((list) => {
        setFolders(list);
        setTarget(routine);
      })
      .catch(fail);
  };

  const sheet = target ? (
    <MoveSheet
      workoutName={target.name}
      folders={folders}
      currentFolderId={target.folder_id}
      onClose={() => setTarget(null)}
      onMove={(folderId) => {
        const name =
          folderId === undefined
            ? "No program"
            : (folders.find((f) => f.id === folderId)?.name ?? "the program");
        void moveTo(target, folderId, name);
      }}
      onCreateAndMove={(programName) => {
        repos.routines
          .createFolder(programName)
          .then((folder) => moveTo(target, folder.id, folder.name))
          .catch(fail);
      }}
    />
  ) : null;

  return { open, sheet, toast: toast ? <UndoToast toast={toast} /> : null };
}

function UndoToast({ toast }: { toast: Toast }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={toast.undo}
      accessibilityRole="button"
      accessibilityLabel={`${toast.text}. Undo`}
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.text }]}
    >
      <Label style={[styles.text, { color: theme.background }]} numberOfLines={2}>
        {toast.text}
      </Label>
      <Label style={{ color: theme.tint }}>Undo</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: 12,
  },
  text: { flex: 1 },
});
