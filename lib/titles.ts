export type TitleCard = {
  id: string;
  kind: string;
  text: string;
  rule: string;
  size: string;
  durationSec: number;
};

export const SAMPLE_TITLE_CARDS: TitleCard[] = [
  { id: "t1", kind: "Episode title", text: "The Shadow We Share", rule: "Minimal. Hold. No kinetic spam.", size: "text-2xl", durationSec: 3 },
  { id: "t2", kind: "Lower third", text: "Auren", rule: "Sparse amber accent only if needed.", size: "text-base", durationSec: 4 },
  { id: "t3", kind: "End card", text: "Until next time.", rule: "Intentional ending / still hold.", size: "text-lg", durationSec: 3 },
];

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
          "Sample title cards as a spec file. Not a live compositor, not After Effects, not a rendered graphic.",
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
