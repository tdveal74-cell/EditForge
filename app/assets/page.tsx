const assets = [
  { id: "a1", name: "TSWS_E01_A_cam_master.mov", type: "video", tags: "master, e01" },
  { id: "a2", name: "auren_vo_take3.wav", type: "audio", tags: "vo, auren" },
  { id: "a3", name: "restraint_score_bed.wav", type: "audio", tags: "music" },
  { id: "a4", name: "still_hold_frame.png", type: "image", tags: "still, ending" },
];

export default function AssetsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber">MAM</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Assets</h1>
      <p className="mt-2 text-sm text-navy/65">Media index. Full MAM can sit on Drive/S3; this is the studio catalog surface.</p>
      <ul className="mt-8 space-y-2">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-card border border-border bg-surface-elevated px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy">{a.name}</p>
              <p className="text-xs text-navy/50">{a.type} · {a.tags}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
