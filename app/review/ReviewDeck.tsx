"use client";

import { useRef, useState } from "react";
import { Section } from "@/components/ui/section";
import { StatusLabel, toneFor } from "@/components/ui/status-dot";
import { MediaEmpty } from "@/components/media/Viewer";
import { formatTimecode, isPlayableVideo } from "@/lib/media";

export type Note = {
  id: string;
  at: string;
  author: string;
  body: string;
  status: string;
};

/** `hh:mm:ss` or `mm:ss` → seconds. Notes are written by people, not machines. */
function toSeconds(at: string): number {
  const parts = at.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/**
 * Review surface: the cut, and the notes against it.
 *
 * The notes carry timestamps, which are worth nothing if reaching the frame
 * means scrubbing by hand. Clicking a note seeks there — that is the whole
 * transaction a review tool exists to make cheap.
 */
export function ReviewDeck({ notes, src }: { notes: Note[]; src?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState<string | null>(null);

  function seek(note: Note) {
    setActive(note.id);
    const el = video.current;
    if (!el) return;
    el.currentTime = toSeconds(note.at);
    void el.play().catch(() => {
      // Autoplay refusal is a browser policy, not a failure worth surfacing —
      // the seek still landed, which is what the click asked for.
    });
  }

  const open = notes.filter((n) => n.status === "open");
  const resolved = notes.filter((n) => n.status !== "open");

  return (
    <>
      <div className="mt-10">
        {src && isPlayableVideo(src) ? (
          <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-card border border-border bg-navy">
            <video
              ref={video}
              src={src}
              controls
              preload="metadata"
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        ) : (
          <MediaEmpty
            what="No cut attached to this review."
            how="A completed render appears here, and notes will seek it."
          />
        )}
      </div>

      {[
        { title: "Open", rows: open },
        { title: "Resolved", rows: resolved },
      ].map(({ title, rows }) => (
        <Section key={title} title={title} count={rows.length}>
          {rows.length === 0 ? (
            <p className="text-sm text-navy/45">Nothing {title.toLowerCase()}.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => seek(n)}
                    aria-label={`Seek to ${n.at} — ${n.body}`}
                    className={`flex w-full items-start gap-3 rounded-card border bg-surface-elevated p-4 text-left transition-all duration-flagship ease-flagship hover:border-border-strong hover:shadow-card ${
                      active === n.id ? "border-amber" : "border-border"
                    }`}
                  >
                    <span className="shrink-0 rounded-control bg-surface-muted px-2 py-0.5 font-mono text-xs tabular-nums text-navy/70">
                      {formatTimecode(toSeconds(n.at))}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-navy/80">{n.body}</span>
                      <span className="mt-0.5 block text-xs text-navy/45">{n.author}</span>
                    </span>
                    <StatusLabel tone={toneFor(n.status)}>{n.status}</StatusLabel>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
    </>
  );
}
