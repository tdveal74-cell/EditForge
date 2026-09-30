/**
 * Browser-only file save. Call from a click handler.
 * Same pattern as a blob download of an EDL — the bytes leave the page.
 */
export function downloadText(filename: string, body: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
