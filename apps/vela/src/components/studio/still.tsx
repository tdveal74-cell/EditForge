import { Btn, Field, Kicker, Slider } from "@/components/studio/controls";
import { ASPECT_RATIO, type Fill, type Layer, type Mask } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const FILLS: Fill[] = ["copper", "paper", "ink", "mute", "raise"];
const FILL_CLASS: Record<Fill, string> = {
  copper: "bg-copper text-copper-ink",
  paper: "bg-paper text-ink",
  ink: "bg-ink text-paper",
  mute: "bg-mute text-ink",
  raise: "bg-raise text-paper",
};
const TEXT_CLASS: Record<Fill, string> = {
  copper: "text-copper",
  paper: "text-paper",
  ink: "text-ink",
  mute: "text-mute",
  raise: "text-paper",
};

export function StillRoom() {
  const project = useProject();
  const selectedId = useStudio((state) => state.selectedLayerId);
  const selectLayer = useStudio((state) => state.selectLayer);
  const addLayer = useStudio((state) => state.addLayer);
  const updateLayer = useStudio((state) => state.updateLayer);
  const deleteLayer = useStudio((state) => state.deleteLayer);
  const applyTemplate = useStudio((state) => state.applyTemplate);
  const matchPosterTitle = useStudio((state) => state.matchPosterTitle);
  const selected = project.layers.find((layer) => layer.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-3 lg:flex-row lg:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h1 className="font-display text-4xl">Still</h1>
          <p className="mt-2 max-w-xl text-pretty text-mute">
            Poster, cover, thumbnail. Same project name as the cut. Pick a template, then move the type.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => applyTemplate("podcast")}>Podcast</Btn>
          <Btn onClick={() => applyTemplate("launch")}>Launch</Btn>
          <Btn onClick={() => applyTemplate("sports")}>Sports</Btn>
          <Btn onClick={() => applyTemplate("thumb")}>Thumb</Btn>
        </div>
        <div className="flex justify-center rounded-lg border border-line bg-raise p-3">
          <div
            className="relative overflow-hidden bg-ink"
            style={{
              aspectRatio: ASPECT_RATIO[project.aspect],
              width: project.aspect === "9:16" ? "12rem" : "100%",
              maxWidth: "40rem",
              maxHeight: "28rem",
            }}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) selectLayer(null);
            }}
          >
            {project.layers.map((layer) => (
              <LayerView
                key={layer.id}
                layer={layer}
                selected={layer.id === selectedId}
                onSelect={() => selectLayer(layer.id)}
                onMove={(x, y) => updateLayer(layer.id, { x, y })}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => addLayer("type")}>Type</Btn>
          <Btn onClick={() => addLayer("block")}>Block</Btn>
          <Btn onClick={() => addLayer("ring")}>Ring</Btn>
          <Btn onClick={() => addLayer("bar")}>Bar</Btn>
          <Btn onClick={matchPosterTitle}>Use project name</Btn>
        </div>
        {selected ? (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
            <Kicker>{selected.name}</Kicker>
            {selected.kind === "type" && (
              <Field label="Text" value={selected.text} onChange={(text) => updateLayer(selected.id, { text })} />
            )}
            <Slider label="X" min={-10} max={90} value={Math.round(selected.x)} onChange={(x) => updateLayer(selected.id, { x })} />
            <Slider label="Y" min={-10} max={90} value={Math.round(selected.y)} onChange={(y) => updateLayer(selected.id, { y })} />
            <Slider label="Width" min={4} max={120} value={Math.round(selected.w)} onChange={(w) => updateLayer(selected.id, { w })} />
            <Slider label="Height" min={2} max={100} value={Math.round(selected.h)} onChange={(h) => updateLayer(selected.id, { h })} />
            <Slider label="Rotate" min={-40} max={40} value={selected.rotate} onChange={(rotate) => updateLayer(selected.id, { rotate })} />
            <Slider label="Opacity" min={10} max={100} value={selected.opacity} onChange={(opacity) => updateLayer(selected.id, { opacity })} />
            <div className="flex flex-wrap gap-2">
              {FILLS.map((fill) => (
                <button
                  key={fill}
                  type="button"
                  aria-label={fill}
                  onClick={() => updateLayer(selected.id, { fill })}
                  className={`h-11 w-11 rounded-md border ${FILL_CLASS[fill]} ${selected.fill === fill ? "border-paper" : "border-line"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {(["none", "round", "soft"] as Mask[]).map((mask) => (
                <Btn key={mask} tone={selected.mask === mask ? "copper" : "ghost"} onClick={() => updateLayer(selected.id, { mask })}>
                  {mask}
                </Btn>
              ))}
            </div>
            <Btn onClick={deleteLayer}>Remove layer</Btn>
          </div>
        ) : (
          <p className="text-sm text-mute">Select a layer on the still.</p>
        )}
      </aside>
    </div>
  );
}

function LayerView({
  layer,
  selected,
  onSelect,
  onMove,
}: {
  layer: Layer;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const soft = layer.mask === "soft" ? "radial-gradient(circle, black 50%, transparent 72%)" : undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
        const parent = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        const originX = event.clientX;
        const originY = event.clientY;
        const x0 = layer.x;
        const y0 = layer.y;
        const el = event.currentTarget;
        el.setPointerCapture(event.pointerId);
        const move = (ev: PointerEvent) => {
          const x = x0 + ((ev.clientX - originX) / parent.width) * 100;
          const y = y0 + ((ev.clientY - originY) / parent.height) * 100;
          onMove(Math.round(x), Math.round(y));
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
      }}
      className={`absolute touch-none ${layer.kind === "type" ? "overflow-visible" : "overflow-hidden"} ${
        layer.mask === "round" || layer.kind === "ring" ? "rounded-full" : ""
      } ${
        layer.kind === "ring"
          ? `border-4 bg-transparent ${TEXT_CLASS[layer.fill]}`
          : layer.kind === "type"
            ? ""
            : FILL_CLASS[layer.fill]
      } ${selected ? "outline outline-2 outline-offset-2 outline-copper" : ""} ${
        layer.font === "display" ? "font-display" : "font-sans"
      }`}
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        width: `${layer.w}%`,
        height: `${layer.h}%`,
        opacity: layer.opacity / 100,
        transform: `rotate(${layer.rotate}deg)`,
        WebkitMaskImage: soft,
        maskImage: soft,
      }}
    >
      {layer.kind === "type" && (
        <span className={`block text-xl leading-tight ${TEXT_CLASS[layer.fill]}`}>{layer.text}</span>
      )}
    </div>
  );
}
