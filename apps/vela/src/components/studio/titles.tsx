import { useState } from "react";
import { Btn, Field, Kicker } from "@/components/studio/controls";
import { Frame } from "@/components/studio/frame";
import { ASPECT_RATIO, type TitleMotion, type TitleStyle } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const STYLES: { id: TitleStyle; label: string }[] = [
  { id: "lower", label: "Lower third" },
  { id: "center", label: "Center" },
  { id: "end", label: "End card" },
];

const MOTIONS: { id: TitleMotion; label: string }[] = [
  { id: "rise", label: "Rise" },
  { id: "snap", label: "Snap" },
  { id: "type", label: "Type on" },
];

export function TitleRoom() {
  const project = useProject();
  const selectedId = useStudio((state) => state.selectedTitleId);
  const selectTitle = useStudio((state) => state.selectTitle);
  const updateTitle = useStudio((state) => state.updateTitle);
  const addTitle = useStudio((state) => state.addTitle);
  const deleteTitle = useStudio((state) => state.deleteTitle);
  const placeTitle = useStudio((state) => state.placeTitle);
  const [playKey, setPlayKey] = useState(0);
  const title = project.titles.find((item) => item.id === selectedId) ?? project.titles[0];
  const picture = project.clips.find((clip) => clip.kind === "picture");

  if (!title) return null;

  const motion = title.motion === "snap" ? "vela-snap" : title.motion === "type" ? "vela-type" : "vela-rise";
  const place =
    title.style === "lower"
      ? "absolute inset-x-0 bottom-8 px-4"
      : title.style === "end"
        ? "absolute inset-0 grid content-end p-4"
        : "absolute inset-0 grid place-items-center p-4 text-center";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">Title</h1>
        <p className="mt-2 max-w-xl text-pretty text-mute">
          Design the card, play the move, then place it on the title track at the playhead. It rides the same grade as the picture.
        </p>
      </div>
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-lg border border-line"
          style={{
            aspectRatio: ASPECT_RATIO[project.aspect],
            width: project.aspect === "9:16" ? "12rem" : "100%",
            maxWidth: "40rem",
            maxHeight: "22rem",
          }}
        >
          <Frame motif={picture?.motif ?? "city"} grade={project.grade} enhance={project.enhance} />
          <div key={`${title.id}-${playKey}`} className={place}>
            <div className={motion}>
              <p className="font-display text-4xl leading-none text-paper">{title.text}</p>
              {title.sub && <p className="mt-1 text-xs tracking-wide text-copper uppercase">{title.sub}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn tone="copper" onClick={() => setPlayKey((value) => value + 1)}>
          Play motion
        </Btn>
        <Btn onClick={placeTitle}>Place on cut</Btn>
        <Btn onClick={addTitle}>New title</Btn>
        <Btn onClick={deleteTitle}>Remove</Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        {project.titles.map((item) => (
          <Btn key={item.id} tone={item.id === title.id ? "copper" : "ghost"} onClick={() => selectTitle(item.id)}>
            {item.text}
          </Btn>
        ))}
      </div>
      <div className="grid gap-3 rounded-lg border border-line bg-panel p-3 md:grid-cols-2">
        <Field label="Main" value={title.text} onChange={(text) => updateTitle(title.id, { text })} />
        <Field label="Sub" value={title.sub} onChange={(sub) => updateTitle(title.id, { sub })} />
        <div className="flex flex-col gap-2">
          <Kicker>Style</Kicker>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <Btn
                key={style.id}
                tone={title.style === style.id ? "copper" : "ghost"}
                onClick={() => updateTitle(title.id, { style: style.id })}
              >
                {style.label}
              </Btn>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Kicker>Motion</Kicker>
          <div className="flex flex-wrap gap-2">
            {MOTIONS.map((item) => (
              <Btn
                key={item.id}
                tone={title.motion === item.id ? "copper" : "ghost"}
                onClick={() => updateTitle(title.id, { motion: item.id })}
              >
                {item.label}
              </Btn>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
