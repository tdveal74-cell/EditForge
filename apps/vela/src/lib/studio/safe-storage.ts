export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let message: string | null = null;
const listeners = new Set<() => void>();
export const storageMessage = () => message;
export const subscribeStorage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function report(value: string | null) { message = value; listeners.forEach((listener) => listener()); }

/** A failed browser write leaves the previous atomic localStorage value intact. */
export function safeStorage(storage: StoragePort, notify: (value: string | null) => void = report): StoragePort {
  const written = new Map<string, string>();
  let readFailed = false;
  return {
    getItem(key) {
      try { const value = storage.getItem(key); readFailed = false; return value; }
      catch { readFailed = true; notify("Saved projects could not be read. Saving is blocked to protect the previous version."); return null; }
    },
    setItem(key, value) {
      if (readFailed) { notify("Saving is blocked because the previous projects could not be read. Keep this tab open and export a copy."); return; }
      if (written.get(key) === value) { notify(null); return; }
      try { storage.setItem(key, value); written.set(key, value); notify(null); }
      catch { notify("Changes are NOT saved. Browser storage is full or unavailable. The last saved version is intact; keep this tab open and export a copy."); }
    },
    removeItem(key) {
      if (readFailed) return;
      try { storage.removeItem(key); written.delete(key); notify(null); }
      catch { notify("The saved project could not be removed. The stored version is unchanged."); }
    },
  };
}

export function studioStorage(): StoragePort {
  if (typeof window === "undefined") return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  try { return safeStorage(window.localStorage); }
  catch {
    const blocked = () => report("Browser storage is unavailable. Changes cannot be saved; keep this tab open and export a copy.");
    blocked();
    return { getItem: () => null, setItem: blocked, removeItem: blocked };
  }
}
