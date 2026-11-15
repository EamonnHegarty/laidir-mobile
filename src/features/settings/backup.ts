import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type { Repositories } from "@/data/index";

/** Writes every local item to a JSON file in the cache and opens the share sheet for it. */
export async function shareBackup(repos: Repositories): Promise<void> {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing isn't available on this phone.");
  const backup = await repos.backup.export();
  const stamp = backup.exported_at.slice(0, 10);
  const file = new File(Paths.cache, `laidir-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup, null, 2));
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Save your Láidir backup",
  });
}
