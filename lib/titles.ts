export type TitleCard = {
  id: string;
  kind: string;
  text: string;
  rule: string;
  size: string;
  durationSec: number;
};

export function newTitleCard(): TitleCard {
  return {
    id: `t-${Date.now().toString(36)}`,
    kind: "Lower third",
    text: "",
    rule: "Sparse. Hold.",
    size: "text-base",
    durationSec: 3,
  };
}

export const SAMPLE_TITLE_CARDS: TitleCard[] = [
  { id: "t1", kind: "Episode title", text: "The Shadow We Share", rule: "Minimal. Hold. No kinetic spam.", size: "text-2xl", durationSec: 3 },
  { id: "t2", kind: "Lower third", text: "Auren", rule: "Sparse amber accent only if needed.", size: "text-base", durationSec: 4 },
  { id: "t3", kind: "End card", text: "Until next time.", rule: "Intentional ending / still hold.", size: "text-lg", durationSec: 3 },
];

export type ParseCardsResult =
  | { ok: true; cards: TitleCard[] }
  | { ok: false; reason: string };

/**
 * The cards the operator edited, or a reason they are not a spec.
 */
export function parseTitleCards(raw: unknown): ParseCardsResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: "At least one title card is required" };
  }
  const seen = new Set<string>();
  const cards: TitleCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, reason: "Each card must be an object" };
    }
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    if (!id) return { ok: false, reason: "Each card needs an id" };
    if (seen.has(id)) return { ok: false, reason: `Duplicate card "${id}"` };
    seen.add(id);
    const kind = String(row.kind ?? "").trim();
    if (!kind) return { ok: false, reason: `Card "${id}" needs a kind` };
    const durationSec = Number(row.durationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return { ok: false, reason: `Card "${id}" needs a duration in seconds` };
    }
    cards.push({
      id,
      kind,
      text: String(row.text ?? ""),
      rule: String(row.rule ?? "").trim() || "Sparse. Hold.",
      size: String(row.size ?? "").trim() || "text-base",
      durationSec,
    });
  }
  return { ok: true, cards };
}

/** Prefix of `text` at animation progress 0..1. The motion preview types this. */
export function typedPrefix(text: string, progress: number): string {
  if (!text) return "";
  const n = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return text.slice(0, Math.round(n * text.length));
}

/**
 * A finishing spec, not a rendered motion graphic.
 * An NLE can read the cards; After Effects is not this page.
 */
export function buildTitleSpec(cards: TitleCard[] = SAMPLE_TITLE_CARDS): string {
  return (
    JSON.stringify(
      {
        kind: "title-card-spec",
        notice:
          "Title card spec. Not a live compositor, not After Effects, not a rendered graphic.",
        cards: cards.map((c) => ({
          id: c.id,
          kind: c.kind,
          text: c.text,
          rule: c.rule,
          durationSec: c.durationSec,
        })),
      },
      null,
      2
    ) + "\n"
  );
}
