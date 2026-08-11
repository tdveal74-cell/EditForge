export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">Bridge</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">NLE bridge</h1>
      <p className="mt-2 text-sm text-navy/65">
        Handoff for Resolve, Premiere, Final Cut. EditForge tracks cut + status; binary timeline lives in the NLE.
      </p>
      <ul className="mt-8 list-inside list-disc space-y-2 text-sm text-navy/70">
        <li>EditForge owns project ID, rubric, and ship decision</li>
        <li>Engine owns pixels, GPU, and realtime playback</li>
        <li>No silent auto-ship from this bridge</li>
      </ul>
    </main>
  );
}
