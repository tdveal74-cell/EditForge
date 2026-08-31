import { durableCollection } from "./durable";
import { SAMPLE_CUES, parseCaptionCues, type CaptionCue } from "./captions";

/**
 * The one stored copy of the caption cue list.
 *
 * /captions used to keep edits in `useState(SAMPLE_CUES)`, so a reload wiped
 * the overlay. Cues live here now, same pattern as the audio ladder.
 */

const cues = durableCollection<CaptionCue>({
  key: "editforge:captions",
  file: "captions.json",
  seed: () => SAMPLE_CUES.map((c) => ({ ...c })),
});

export async function getCaptionCues(): Promise<CaptionCue[]> {
  const rows = await cues.list();
  return rows.length ? rows : SAMPLE_CUES;
}

export async function saveCaptionCues(
  raw: unknown
): Promise<{ ok: true; cues: CaptionCue[] } | { ok: false; reason: string }> {
  const parsed = parseCaptionCues(raw);
  if (!parsed.ok) return parsed;
  await cues.mutate((items) => {
    items.splice(0, items.length, ...parsed.cues);
  });
  return { ok: true, cues: parsed.cues };
}
