/**
 * Stable idempotency keys, derived from the brief itself.
 *
 * A random key per click would make a double-click two paid renders. Deriving
 * the key from the request means submitting the same brief twice returns the
 * first job, and changing any part of the brief is correctly a new one.
 */

/** Order-independent so `{a,b}` and `{b,a}` describe the same work. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

/** FNV-1a, 32-bit. Not a security hash — just a short, stable fingerprint. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // Multiply by the FNV prime in 32-bit space without overflowing to float.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Key for one unit of provider work. `kind` is included so a voice job and a
 * video job built from the same prompt never collide.
 */
export function idempotencyKeyFor(kind: string, brief: Record<string, unknown>): string {
  return `${kind}-${fnv1a(stable(brief))}`;
}
