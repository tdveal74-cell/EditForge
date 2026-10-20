import { useState } from "react";
import { Btn, Kicker, Slider } from "@/components/studio/controls";
import { Frame } from "@/components/studio/frame";
import { ASPECT_RATIO, clipAt, type SkinArea, type SkinPass } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const PASSES: { id: SkinPass; label: string }[] = [
  { id: "fix", label: "Fix skin" },
  { id: "unpolish", label: "Unpolish" },
  { id: "shine", label: "Fix shine" },
  { id: "retouch", label: "Retouch" },
];

const AREAS: { id: SkinArea; label: string }[] = [
  { id: "all", label: "All" },
  { id: "face", label: "Face" },
  { id: "eyes", label: "Eyes" },
  { id: "mouth", label: "Mouth" },
];

export function EnhanceRoom() {
  const project = useProject();
  const playhead = useStudio((state) => state.playhead);
  const setEnhance = useStudio((state) => state.setEnhance);
  const setEnhanceScale = useStudio((state) => state.setEnhanceScale);
  const picture = clipAt(project.clips, 0, playhead);
  const enhance = project.enhance;
  const [split, setSplit] = useState(52);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">Enhance</h1>
        <p className="mt-2 max-w-2xl text-pretty text-mute">
          Break the plastic look on the picture at the playhead. Pores, freckles, shine, and retouch. Grade stays in Cut.
        </p>
      </div>
      <div className={`mx-auto w-full ${enhance.scale === 2 ? "max-w-4xl" : "max-w-xl"}`}>
        <div className="relative overflow-hidden rounded-lg border border-line bg-ink" style={{ aspectRatio: ASPECT_RATIO[project.aspect] }}>
          <Frame motif={picture?.motif ?? "city"} grade={project.grade} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            <Frame motif={picture?.motif ?? "city"} grade={project.grade} enhance={enhance} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-paper" style={{ left: `${split}%` }} />
        </div>
        <label className="mt-2 flex items-center gap-3 text-xs text-mute">
          Before
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            className="min-h-11 flex-1 accent-copper"
            aria-label="Before and after"
          />
          After
        </label>
        <p className="text-xs text-mute">{picture ? picture.name : "No picture at the playhead. The grade still shows."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PASSES.map((item) => (
          <Btn key={item.id} tone={enhance.pass === item.id ? "copper" : "ghost"} onClick={() => setEnhance({ pass: item.id })}>
            {item.label}
          </Btn>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {AREAS.map((item) => (
          <Btn key={item.id} tone={enhance.area === item.id ? "copper" : "ghost"} onClick={() => setEnhance({ area: item.id })}>
            {item.label}
          </Btn>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Kicker>Skin</Kicker>
          <Slider label="Texture" min={0} max={100} value={enhance.texture} onChange={(texture) => setEnhance({ texture })} />
          <Slider label="Freckles" min={0} max={100} value={enhance.freckles} onChange={(freckles) => setEnhance({ freckles })} />
        </div>
        <div className="flex flex-col gap-3">
          <Kicker>Finish</Kicker>
          <Slider label="Smooth" min={0} max={100} value={enhance.smoothness} onChange={(smoothness) => setEnhance({ smoothness })} />
          <Slider label="Detail" min={0} max={100} value={enhance.detail} onChange={(detail) => setEnhance({ detail })} />
          <div className="flex flex-wrap gap-2">
            <Btn tone={enhance.scale === 1 ? "copper" : "ghost"} onClick={() => setEnhanceScale(1)}>
              Inspect 1×
            </Btn>
            <Btn tone={enhance.scale === 2 ? "copper" : "ghost"} onClick={() => setEnhanceScale(2)}>
              Inspect 2×
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
