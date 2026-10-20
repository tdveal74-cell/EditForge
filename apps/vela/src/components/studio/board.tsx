import { ChevronDown, ChevronUp } from "lucide-react";
import { Btn, Field } from "@/components/studio/controls";
import type { BoardCard } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const ACTS = [
  { id: 1 as const, label: "Act I" },
  { id: 2 as const, label: "Act II" },
  { id: 3 as const, label: "Act III" },
];

export function BoardRoom() {
  const project = useProject();
  const addCard = useStudio((state) => state.addCard);
  const updateCard = useStudio((state) => state.updateCard);
  const moveCard = useStudio((state) => state.moveCard);
  const deleteCard = useStudio((state) => state.deleteCard);
  const rebuildBoard = useStudio((state) => state.rebuildBoard);

  return (
    <div className="flex flex-col gap-4 p-3 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Board</h1>
          <p className="mt-2 max-w-xl text-pretty text-mute">
            Beats stay in three acts, in the dark, next to the cut they describe. Pull them from the script when the page is ahead of the cards.
          </p>
        </div>
        <Btn onClick={rebuildBoard}>Rebuild from script</Btn>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {ACTS.map((act) => (
          <section key={act.id} className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">{act.label}</h2>
              <Btn onClick={() => addCard(act.id)}>Add</Btn>
            </div>
            {project.board
              .filter((card) => card.act === act.id)
              .map((card, index, list) => (
                <Card
                  key={card.id}
                  card={card}
                  first={index === 0}
                  last={index === list.length - 1}
                  onChange={(partial) => updateCard(card.id, partial)}
                  onUp={() => moveCard(card.id, -1)}
                  onDown={() => moveCard(card.id, 1)}
                  onDelete={() => deleteCard(card.id)}
                  onAct={(next) => updateCard(card.id, { act: next })}
                />
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({
  card,
  first,
  last,
  onChange,
  onUp,
  onDown,
  onDelete,
  onAct,
}: {
  card: BoardCard;
  first: boolean;
  last: boolean;
  onChange: (partial: Partial<BoardCard>) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  onAct: (act: 1 | 2 | 3) => void;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-md border border-line bg-ink p-3">
      <Field label="Beat" value={card.title} onChange={(title) => onChange({ title })} />
      <Field label="Note" value={card.body} onChange={(body) => onChange({ body })} multiline />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-md border border-line" onClick={onUp} disabled={first} aria-label="Move up">
          <ChevronUp className="size-4" />
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-md border border-line" onClick={onDown} disabled={last} aria-label="Move down">
          <ChevronDown className="size-4" />
        </button>
        <label className="text-xs text-mute">
          Act
          <select
            value={card.act}
            onChange={(event) => onAct(Number(event.target.value) as 1 | 2 | 3)}
            className="ml-2 h-11 rounded-md border border-line bg-raise px-2 text-sm text-paper"
          >
            <option value={1}>I</option>
            <option value={2}>II</option>
            <option value={3}>III</option>
          </select>
        </label>
        <button type="button" className="ml-auto text-xs text-mute" onClick={onDelete}>
          Remove
        </button>
      </div>
    </article>
  );
}
