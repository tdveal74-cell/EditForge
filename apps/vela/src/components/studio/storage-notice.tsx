import { useSyncExternalStore } from "react";
import { storageMessage, subscribeStorage } from "@/lib/studio/safe-storage";
import { useStudio } from "@/lib/studio/store";

export function StorageNotice() {
  const message = useSyncExternalStore(subscribeStorage, storageMessage, () => null);
  return message ? <div role="alert" className="fixed inset-x-2 top-2 z-50 rounded border border-copper bg-ink p-3 text-sm text-paper">
    <p>{message}</p>
    <button type="button" className="mt-2 min-h-11 rounded border border-line px-3" onClick={() => useStudio.getState().setExportOpen(true)}>Export current project</button>
  </div> : null;
}
