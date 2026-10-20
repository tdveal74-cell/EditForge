const urls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("vela-booth", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaBatch(items: { id: string; blob: Blob }[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("audio", "readwrite");
      for (const item of items) tx.objectStore("audio").put(item.blob, item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Media save was aborted."));
    });
  } finally { db.close(); }
  for (const { id, blob } of items) {
    const prev = urls.get(id);
    if (prev) URL.revokeObjectURL(prev);
    urls.set(id, URL.createObjectURL(blob));
  }
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  await saveMediaBatch([{ id, blob }]);
}

export async function audioUrl(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction("audio", "readonly");
    const request = tx.objectStore("audio").get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export function downloadAudio(filename: string, url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}
