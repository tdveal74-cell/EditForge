import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Assets" };

const assets = [
  { id: "a1", name: "TSWS_E01_A_cam_master.mov", type: "video", tags: ["master", "e01"] },
  { id: "a2", name: "auren_vo_take3.wav", type: "audio", tags: ["vo", "auren"] },
  { id: "a3", name: "restraint_score_bed.wav", type: "audio", tags: ["music"] },
  { id: "a4", name: "still_hold_frame.png", type: "image", tags: ["still", "ending"] },
];

const glyph: Record<string, string> = { video: "▶", audio: "⌁", image: "▣" };

export default function AssetsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="MAM"
        title="Assets"
        description="The catalog surface. Bytes live on Drive, S3, or Frame.io behind /mam — this is the index that knows where."
      />

      <ul className="mt-10 divide-y divide-border-faint overflow-hidden rounded-card border border-border bg-surface-elevated shadow-card">
        {assets.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-flagship hover:bg-surface-muted/50"
          >
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-control bg-surface-muted text-xs text-navy/45"
            >
              {glyph[a.type] ?? "•"}
            </span>
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-navy">{a.name}</p>
            <div className="hidden shrink-0 gap-1.5 sm:flex">
              {a.tags.map((t) => (
                <Badge key={t} tone="neutral">
                  {t}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
