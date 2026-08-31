import { durableCollection } from "./durable";
import { SAMPLE_TITLE_CARDS, parseTitleCards, type TitleCard } from "./titles";

/**
 * The one stored copy of the title cards.
 *
 * /titles used to keep edits in `useState(SAMPLE_TITLE_CARDS)`, so a reload
 * reset the spec. Cards live here now, same pattern as the audio ladder.
 */

const cards = durableCollection<TitleCard>({
  key: "editforge:titles",
  file: "titles.json",
  seed: () => SAMPLE_TITLE_CARDS.map((c) => ({ ...c })),
});

export async function getTitleCards(): Promise<TitleCard[]> {
  const rows = await cards.list();
  return rows.length ? rows : SAMPLE_TITLE_CARDS;
}

export async function saveTitleCards(
  raw: unknown
): Promise<{ ok: true; cards: TitleCard[] } | { ok: false; reason: string }> {
  const parsed = parseTitleCards(raw);
  if (!parsed.ok) return parsed;
  await cards.mutate((items) => {
    items.splice(0, items.length, ...parsed.cards);
  });
  return { ok: true, cards: parsed.cards };
}
