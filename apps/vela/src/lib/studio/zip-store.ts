/** Uncompressed ZIP, streamed per Blob. No extraction paths or ZIP64 support. */
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const table = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const LIMIT = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY = 256 * 1024 * 1024;

export async function crc32(blob: Blob): Promise<number> {
  let value = 0xffffffff;
  const reader = blob.stream().getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const byte of chunk.value) value = table[(value ^ byte) & 255] ^ (value >>> 8);
    }
  } finally { reader.releaseLock(); }
  return (value ^ 0xffffffff) >>> 0;
}

function validPath(path: string): boolean {
  return path.length > 0 && path.length < 250 && /^[a-zA-Z0-9._/-]+$/.test(path)
    && !path.startsWith("/") && path.split("/").every((part) => part !== ".." && part !== "." && part !== "");
}

export async function writeZip(entries: { path: string; blob: Blob }[]): Promise<Blob> {
  if (!entries.length || entries.length > 2000) throw new Error("Invalid archive entry count.");
  const chunks: BlobPart[] = [];
  const central: BlobPart[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (const { path, blob } of entries) {
    if (!validPath(path) || seen.has(path) || blob.size > MAX_ENTRY) throw new Error("Invalid, duplicate or oversized archive entry.");
    seen.add(path);
    const name = encoder.encode(path);
    const checksum = await crc32(blob);
    const header = new Uint8Array(30 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
    h.setUint16(12, 0x21, true);
    h.setUint32(14, checksum, true); h.setUint32(18, blob.size, true); h.setUint32(22, blob.size, true);
    h.setUint16(26, name.length, true); header.set(name, 30);
    const directory = new Uint8Array(46 + name.length);
    const d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true);
    d.setUint16(14, 0x21, true);
    d.setUint32(16, checksum, true); d.setUint32(20, blob.size, true); d.setUint32(24, blob.size, true);
    d.setUint16(28, name.length, true); d.setUint32(42, offset, true); directory.set(name, 46);
    chunks.push(header, blob); central.push(directory);
    offset += header.length + blob.size;
    if (offset > LIMIT) throw new Error("This backup exceeds the 2 GB browser archive limit.");
  }
  const directory = new Blob(central);
  if (offset + directory.size + 22 > LIMIT) throw new Error("This backup exceeds the 2 GB browser archive limit.");
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true);
  e.setUint32(12, directory.size, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, directory, end], { type: "application/zip" });
}

export async function readZip(file: Blob): Promise<Map<string, Blob>> {
  if (file.size < 22 || file.size > LIMIT) throw new Error("Invalid or oversized Vela archive.");
  const end = new DataView(await file.slice(-22).arrayBuffer());
  if (end.getUint32(0, true) !== 0x06054b50 || end.getUint16(4, true) || end.getUint16(6, true)
    || end.getUint16(20, true) || end.getUint16(8, true) !== end.getUint16(10, true)) throw new Error("Unsupported or incomplete ZIP archive.");
  const count = end.getUint16(10, true);
  const directorySize = end.getUint32(12, true);
  const directoryOffset = end.getUint32(16, true);
  if (!count || count > 2000 || directorySize > 1024 * 1024 || directoryOffset + directorySize + 22 !== file.size) throw new Error("Archive directory is inconsistent.");
  const directory = new Uint8Array(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());
  const entries = new Map<string, Blob>();
  let cursor = 0;
  let dataEnd = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > directory.length) throw new Error("Truncated archive directory.");
    const d = new DataView(directory.buffer, directory.byteOffset + cursor);
    const flags = d.getUint16(8, true), method = d.getUint16(10, true), size = d.getUint32(24, true);
    const nameLength = d.getUint16(28, true), extra = d.getUint16(30, true), comment = d.getUint16(32, true);
    const offset = d.getUint32(42, true), expectedCrc = d.getUint32(16, true);
    if (d.getUint32(0, true) !== 0x02014b50 || flags !== 0x800 || method !== 0 || size !== d.getUint32(20, true)
      || size > MAX_ENTRY || extra || comment || d.getUint16(34, true) || cursor + 46 + nameLength > directory.length) throw new Error("Unsupported ZIP entry.");
    const nameBytes = directory.slice(cursor + 46, cursor + 46 + nameLength);
    const path = decoder.decode(nameBytes);
    if (!validPath(path) || entries.has(path) || offset !== dataEnd || offset + 30 + nameLength + size > directoryOffset) throw new Error("Invalid archive path or entry bounds.");
    const local = new DataView(await file.slice(offset, offset + 30).arrayBuffer());
    if (local.getUint32(0, true) !== 0x04034b50 || local.getUint16(6, true) !== flags || local.getUint16(8, true) !== method
      || local.getUint32(14, true) !== expectedCrc || local.getUint32(18, true) !== size || local.getUint32(22, true) !== size
      || local.getUint16(26, true) !== nameLength || local.getUint16(28, true)) throw new Error("Archive headers do not match.");
    const localName = decoder.decode(await file.slice(offset + 30, offset + 30 + nameLength).arrayBuffer());
    if (localName !== path) throw new Error("Archive filenames do not match.");
    const blob = file.slice(offset + 30 + nameLength, offset + 30 + nameLength + size);
    if (await crc32(blob) !== expectedCrc) throw new Error(`Archive checksum failed: ${path}`);
    entries.set(path, blob);
    dataEnd = offset + 30 + nameLength + size;
    cursor += 46 + nameLength + extra + comment;
  }
  if (cursor !== directory.length || dataEnd !== directoryOffset) throw new Error("Unaccounted archive data.");
  return entries;
}
