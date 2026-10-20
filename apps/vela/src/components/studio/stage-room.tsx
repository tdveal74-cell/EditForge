import { Btn, Kicker, Slider } from "@/components/studio/controls";
import { LOCATION_LABEL, PROP_LABEL, type Location, type PropKind, type StageProp } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const LOCATIONS: Location[] = ["market", "alley", "studio", "void"];
const KINDS: PropKind[] = ["figure", "lamp", "crate", "card", "arch"];

const WASH: Record<Location, string> = {
  market: "bg-panel",
  alley: "bg-ink",
  studio: "bg-raise",
  void: "bg-ink",
};

export function StageRoom() {
  const project = useProject();
  const selectedId = useStudio((state) => state.selectedPropId);
  const selectProp = useStudio((state) => state.selectProp);
  const setStage = useStudio((state) => state.setStage);
  const addProp = useStudio((state) => state.addProp);
  const placeStillCard = useStudio((state) => state.placeStillCard);
  const updateProp = useStudio((state) => state.updateProp);
  const deleteProp = useStudio((state) => state.deleteProp);
  const sendShot = useStudio((state) => state.sendShot);
  const stage = project.stage;
  const selected = stage.props.find((prop) => prop.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-3 lg:flex-row lg:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h1 className="font-display text-4xl">Stage</h1>
          <p className="mt-2 max-w-xl text-pretty text-mute">
            Block the shot the way a 3D stage does. One location, a camera, and props. This is not the poster, and it is not a second timeline.
          </p>
        </div>
        <div
          className={`relative h-72 overflow-hidden rounded-lg border border-line sm:h-96 ${WASH[stage.location]}`}
          onPointerDown={() => selectProp(null)}
        >
          {stage.backdrop && <LocationWash location={stage.location} />}
          <div className="absolute inset-0" style={{ perspective: "820px" }}>
            <div
              className="absolute top-[62%] left-1/2 h-0 w-0"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateX(${stage.pitch}deg) rotateY(${stage.yaw}deg) translateZ(${stage.dolly}px)`,
              }}
            >
              <div
                className="absolute border border-line bg-ink/40"
                style={{
                  width: 360,
                  height: 360,
                  left: -180,
                  top: -20,
                  transform: "rotateX(90deg)",
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent 0 28px, color-mix(in srgb, var(--color-line) 80%, transparent) 28px 29px), repeating-linear-gradient(90deg, transparent 0 28px, color-mix(in srgb, var(--color-line) 80%, transparent) 28px 29px)",
                }}
              />
              {stage.props.map((prop) => (
                <PropMesh
                  key={prop.id}
                  prop={prop}
                  selected={prop.id === selectedId}
                  onSelect={() => selectProp(prop.id)}
                />
              ))}
            </div>
          </div>
          <p className="absolute bottom-2 left-3 text-xs text-mute">{LOCATION_LABEL[stage.location]}</p>
        </div>
      </div>
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
        <Kicker>Location</Kicker>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((location) => (
            <Btn key={location} tone={stage.location === location ? "copper" : "ghost"} onClick={() => setStage({ location })}>
              {LOCATION_LABEL[location]}
            </Btn>
          ))}
        </div>
        <Btn tone={stage.backdrop ? "copper" : "ghost"} onClick={() => setStage({ backdrop: !stage.backdrop })}>
          {stage.backdrop ? "Backdrop on" : "Backdrop lifted"}
        </Btn>
        <Slider label="Yaw" min={-180} max={180} value={stage.yaw} onChange={(yaw) => setStage({ yaw })} />
        <Slider label="Pitch" min={-12} max={64} value={stage.pitch} onChange={(pitch) => setStage({ pitch })} />
        <Slider label="Dolly" min={-120} max={80} value={stage.dolly} onChange={(dolly) => setStage({ dolly })} />
        <Kicker>Outliner</Kicker>
        <div className="flex flex-col gap-1">
          {stage.props.map((prop) => (
            <button
              key={prop.id}
              type="button"
              onClick={() => selectProp(prop.id)}
              className={`min-h-11 rounded-md border px-3 text-left text-sm ${prop.id === selectedId ? "border-copper text-paper" : "border-line text-mute"}`}
            >
              {prop.name}
              <span className="ml-2 text-xs">{PROP_LABEL[prop.kind]}</span>
            </button>
          ))}
          {stage.props.length === 0 && <p className="text-sm text-mute">No props yet.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((kind) => (
            <Btn key={kind} onClick={() => addProp(kind)}>
              {PROP_LABEL[kind]}
            </Btn>
          ))}
          <Btn onClick={placeStillCard}>Still as card</Btn>
        </div>
        {selected && (
          <div className="flex flex-col gap-3 rounded-md border border-line p-3">
            <label className="flex flex-col gap-1 text-xs text-mute">
              Name
              <input
                value={selected.name}
                onChange={(event) => updateProp(selected.id, { name: event.target.value })}
                className="min-h-11 rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none focus:border-copper"
              />
            </label>
            <Slider label="X" min={-140} max={140} value={selected.x} onChange={(x) => updateProp(selected.id, { x })} />
            <Slider label="Y" min={0} max={120} value={selected.y} onChange={(y) => updateProp(selected.id, { y })} />
            <Slider label="Z" min={-140} max={160} value={selected.z} onChange={(z) => updateProp(selected.id, { z })} />
            <Slider label="Rotate" min={-180} max={180} value={selected.rotY} onChange={(rotY) => updateProp(selected.id, { rotY })} />
            <Slider label="Scale" min={0.4} max={2.2} step={0.1} value={selected.scale} onChange={(scale) => updateProp(selected.id, { scale })} />
            {selected.kind === "figure" && (
              <Slider label="Pose" min={0} max={100} value={selected.pose} onChange={(pose) => updateProp(selected.id, { pose })} />
            )}
            <Btn onClick={deleteProp}>Remove prop</Btn>
          </div>
        )}
        <Btn tone="copper" onClick={sendShot}>
          Send shot to cut
        </Btn>
      </aside>
    </div>
  );
}

function LocationWash({ location }: { location: Location }) {
  if (location === "void") return null;
  if (location === "studio") {
    return <div className="absolute inset-x-0 top-0 h-1/3 bg-copper/20" />;
  }
  return (
    <div
      className="absolute inset-0 opacity-70"
      style={{
        backgroundImage:
          location === "market"
            ? "repeating-linear-gradient(108deg, transparent 0 18px, color-mix(in srgb, var(--color-copper) 35%, transparent) 18px 19px)"
            : "repeating-linear-gradient(90deg, transparent 0 42px, color-mix(in srgb, var(--color-mute) 25%, transparent) 42px 44px)",
      }}
    />
  );
}

function PropMesh({ prop, selected, onSelect }: { prop: StageProp; selected: boolean; onSelect: () => void }) {
  const width = 46 * prop.scale;
  const height = (prop.kind === "figure" || prop.kind === "arch" ? 92 : 48) * prop.scale;
  return (
    <button
      type="button"
      aria-label={prop.name}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={`absolute ${selected ? "ring-2 ring-copper" : ""}`}
      style={{
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height,
        transformStyle: "preserve-3d",
        transform: `translate3d(${prop.x}px, ${-prop.y}px, ${prop.z}px) rotateY(${prop.rotY}deg)`,
      }}
    >
      <MeshBody prop={prop} />
    </button>
  );
}

function MeshBody({ prop }: { prop: StageProp }) {
  if (prop.kind === "figure") {
    const arm = (prop.pose - 50) * 0.9;
    return (
      <div className="relative h-full w-full">
        <div className="absolute bottom-0 left-1/4 h-2/5 w-1/5 bg-mute" />
        <div className="absolute bottom-0 right-1/4 h-2/5 w-1/5 bg-mute" />
        <div className="absolute bottom-[36%] left-[18%] h-[38%] w-[64%] rounded-sm bg-raise" />
        <div className="absolute top-0 left-1/2 h-[22%] w-[34%] -translate-x-1/2 rounded-full bg-paper" />
        <div className="absolute top-[28%] left-0 h-[8%] w-[28%] origin-right bg-paper" style={{ transform: `rotate(${-arm}deg)` }} />
        <div className="absolute top-[28%] right-0 h-[8%] w-[28%] origin-left bg-paper" style={{ transform: `rotate(${arm}deg)` }} />
      </div>
    );
  }
  if (prop.kind === "lamp") {
    return (
      <div className="relative h-full w-full">
        <div className="absolute bottom-0 left-1/2 h-3/4 w-[8%] -translate-x-1/2 bg-mute" />
        <div className="absolute top-[8%] left-1/2 size-[46%] -translate-x-1/2 rounded-full bg-copper shadow-[0_0_18px_var(--color-copper)]" />
      </div>
    );
  }
  if (prop.kind === "arch") {
    return <div className="h-full w-full rounded-t-full border-4 border-b-0 border-copper bg-transparent" />;
  }
  if (prop.kind === "card") {
    return (
      <div className="flex h-full w-full flex-col justify-end bg-paper p-1 text-ink">
        <span className="h-1 w-1/2 bg-copper" />
        <span className="mt-1 truncate text-[10px] leading-none">{prop.name}</span>
      </div>
    );
  }
  return (
    <div className="h-full w-full border border-line bg-raise">
      <div className="h-1/4 bg-mute/40" />
    </div>
  );
}
