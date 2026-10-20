import { useRef } from "react";
import { Pause, Play, Scissors } from "lucide-react";
import { Btn, Field, Kicker, Slider } from "@/components/studio/controls";
import { Frame } from "@/components/studio/frame";
import { Face, usePlate } from "@/components/studio/plate";
import { ASPECT_RATIO, clipAt, defaultLikeness, fmt, projectDuration, type Clip } from "@/lib/studio/model";
import { useMouth } from "@/lib/studio/performance";
import { useProject, useStudio } from "@/lib/studio/store";

export function CutRoom() {
  const project = useProject();
  const playhead = useStudio((state) => state.playhead);
  const playing = useStudio((state) => state.playing);
  const selectedId = useStudio((state) => state.selectedClipId);
  const togglePlay = useStudio((state) => state.togglePlay);
  const splitClip = useStudio((state) => state.splitClip);
  const addPicture = useStudio((state) => state.addPicture);
  const closeGaps = useStudio((state) => state.closeGaps);
  const deleteClip = useStudio((state) => state.deleteClip);
  const duplicateClip = useStudio((state) => state.duplicateClip);
  const setClipName = useStudio((state) => state.setClipName);
  const setClipDuration = useStudio((state) => state.setClipDuration);
  const setGrade = useStudio((state) => state.setGrade);
  const setCaptionText = useStudio((state) => state.setCaptionText);
  const deleteCaption = useStudio((state) => state.deleteCaption);
  const addCaption = useStudio((state) => state.addCaption);
  const setPlayhead = useStudio((state) => state.setPlayhead);
  const mouth = useMouth();
  const likeness = project.likeness ?? defaultLikeness();
  const plateUrl = usePlate(likeness.plateId);

  const duration = projectDuration(project);
  const picture = clipAt(project.clips, 0, playhead);
  const upper = clipAt(project.clips, 1, playhead);
  const title = upper?.kind === "title" ? upper : null;
  const voice = upper?.kind === "voice" ? upper : null;
  const bed = clipAt(project.clips, 2, playhead);
  const score = bed?.kind === "score" ? bed : null;
  const caption = project.captions.find((item) => playhead >= item.start && playhead < item.end);
  const selected = project.clips.find((clip) => clip.id === selectedId) ?? null;
  const ratio = ASPECT_RATIO[project.aspect];

  return (
    <div className="flex flex-col gap-4 p-3 lg:flex-row lg:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg border border-line bg-ink"
            style={{
              aspectRatio: ratio,
              width: project.aspect === "16:9" ? "100%" : undefined,
              height: project.aspect === "16:9" ? undefined : "18rem",
              maxWidth: "100%",
              maxHeight: "20rem",
            }}
          >
            {picture ? <Frame motif={picture.motif} grade={project.grade} enhance={project.enhance} /> : <div className="grid h-full place-items-center text-sm text-mute">No picture here</div>}
            {title && <TitleOverlay clip={title} />}
            {voice && (
              <div className="absolute bottom-2 left-2 h-[46%] w-[30%]">
                <Face
                  look={voice.look ?? "ink"}
                  mouth={mouth}
                  label={voice.sub}
                  plateUrl={plateUrl}
                  enhance={project.enhance}
                  likeness={likeness}
                />
              </div>
            )}
            {caption && (
              <div className="absolute inset-x-3 bottom-3 rounded-md bg-ink/80 px-2 py-1 text-center text-sm text-paper">
                {caption.text}
              </div>
            )}
            {score && (
              <div className="absolute top-2 right-2 rounded-md bg-copper px-2 py-1 text-xs text-copper-ink">Score</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="copper" onClick={togglePlay}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play"}
          </Btn>
          <span className="tabular-nums text-sm text-mute">
            {fmt(playhead)} / {fmt(duration)}
          </span>
          <Btn onClick={splitClip}>
            <Scissors className="size-4" />
            Split
          </Btn>
          <Btn onClick={addPicture}>Add picture</Btn>
          <Btn onClick={closeGaps}>Close gaps</Btn>
        </div>

        <Timeline duration={duration} playhead={playhead} clips={project.clips} selectedId={selectedId} />
        <p className="text-xs text-mute">Space plays. S splits. Drag a clip. Drag its right edge to trim.</p>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
          <Kicker>Clip</Kicker>
          {selected ? (
            <>
              <Field label="Name" value={selected.name} onChange={(name) => setClipName(selected.id, name)} />
              <Slider
                label="Length"
                min={0.25}
                max={12}
                step={0.25}
                value={selected.duration}
                onChange={(value) => setClipDuration(selected.id, value)}
              />
              <div className="flex gap-2">
                <Btn onClick={duplicateClip}>Duplicate</Btn>
                <Btn onClick={deleteClip}>Remove</Btn>
              </div>
            </>
          ) : (
            <p className="text-sm text-mute">Select a clip on the timeline.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
          <Kicker>Grade and focus</Kicker>
          <Slider label="Exposure" min={-40} max={40} value={project.grade.exposure} onChange={(value) => setGrade("exposure", value)} />
          <Slider label="Contrast" min={-40} max={40} value={project.grade.contrast} onChange={(value) => setGrade("contrast", value)} />
          <Slider label="Saturation" min={-40} max={40} value={project.grade.saturation} onChange={(value) => setGrade("saturation", value)} />
          <Slider label="Warmth" min={-40} max={40} value={project.grade.warmth} onChange={(value) => setGrade("warmth", value)} />
          <Slider label="Vignette" min={0} max={80} value={project.grade.vignette} onChange={(value) => setGrade("vignette", value)} />
          <Slider label="Focus pull" min={0} max={100} value={project.grade.depth} onChange={(value) => setGrade("depth", value)} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center justify-between">
            <Kicker>Captions</Kicker>
            <button type="button" className="text-xs text-copper" onClick={addCaption}>
              Add at playhead
            </button>
          </div>
          {project.captions.length === 0 && <p className="text-sm text-mute">None yet.</p>}
          {project.captions.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <button type="button" className="text-left text-xs text-mute tabular-nums" onClick={() => setPlayhead(item.start)}>
                {fmt(item.start)}
              </button>
              <input
                value={item.text}
                onChange={(event) => setCaptionText(item.id, event.target.value)}
                className="min-h-11 rounded-md border border-line bg-ink px-2 text-sm text-paper outline-none focus:border-copper"
              />
              <button type="button" className="self-start text-xs text-mute" onClick={() => deleteCaption(item.id)}>
                Remove line
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function TitleOverlay({ clip }: { clip: Clip }) {
  const motion = clip.motion === "snap" ? "vela-snap" : clip.motion === "type" ? "vela-type" : "vela-rise";
  const place =
    clip.style === "lower"
      ? "absolute inset-x-0 bottom-10 px-4 text-left"
      : clip.style === "end"
        ? "absolute inset-0 grid place-items-end p-4"
        : "absolute inset-0 grid place-items-center p-4 text-center";
  return (
    <div key={clip.id} className={place}>
      <div className={motion}>
              <p className="font-display text-3xl leading-none text-paper">{clip.text}</p>
        {clip.sub && <p className="mt-1 text-xs tracking-wide text-copper uppercase">{clip.sub}</p>}
      </div>
    </div>
  );
}

function Timeline({
  duration,
  playhead,
  clips,
  selectedId,
}: {
  duration: number;
  playhead: number;
  clips: Clip[];
  selectedId: string | null;
}) {
  const pps = 64;
  const width = duration * pps + 32;
  const contentRef = useRef<HTMLDivElement>(null);
  const setPlayhead = useStudio((state) => state.setPlayhead);
  const setPlaying = useStudio((state) => state.setPlaying);
  const selectClip = useStudio((state) => state.selectClip);
  const moveClip = useStudio((state) => state.moveClip);
  const setClipDuration = useStudio((state) => state.setClipDuration);

  const seek = (clientX: number) => {
    const bounds = contentRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const time = Math.max(0, Math.min(duration, (clientX - bounds.left) / pps));
    setPlaying(false);
    setPlayhead(time);
  };

  const tracks: { track: 0 | 1 | 2; label: string }[] = [
    { track: 0, label: "Picture" },
    { track: 1, label: "Title" },
    { track: 2, label: "Score" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <div ref={contentRef} className="relative" style={{ width }}>
        <div className="relative h-8 border-b border-line" onPointerDown={(event) => seek(event.clientX)}>
          {Array.from({ length: Math.ceil(duration) + 1 }, (_, second) => (
            <span key={second} className="absolute top-1 text-xs text-mute tabular-nums" style={{ left: second * pps }}>
              {second}s
            </span>
          ))}
        </div>
        {tracks.map((lane) => (
          <div key={lane.track} className="relative h-14 border-b border-line" onPointerDown={(event) => {
            if (event.target === event.currentTarget) seek(event.clientX);
          }}>
            <span className="pointer-events-none absolute top-1 left-1 text-xs text-mute">{lane.label}</span>
            {clips
              .filter((clip) => clip.track === lane.track)
              .map((clip) => (
                <div
                  key={clip.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).dataset.handle) return;
                    event.stopPropagation();
                    selectClip(clip.id);
                    const origin = event.clientX;
                    const start0 = clip.start;
                    const el = event.currentTarget;
                    el.setPointerCapture(event.pointerId);
                    const move = (ev: PointerEvent) => {
                      const next = Math.round((start0 + (ev.clientX - origin) / pps) * 4) / 4;
                      moveClip(clip.id, Math.max(0, next));
                    };
                    const up = () => {
                      el.removeEventListener("pointermove", move);
                      el.removeEventListener("pointerup", up);
                    };
                    el.addEventListener("pointermove", move);
                    el.addEventListener("pointerup", up);
                  }}
                  className={`absolute top-5 bottom-1 touch-none overflow-hidden rounded-sm px-2 text-left text-xs ${
                    clip.kind === "score"
                      ? "bg-copper text-copper-ink"
                      : clip.kind === "title"
                        ? "bg-paper text-ink"
                        : clip.kind === "voice"
                          ? "border border-copper bg-ink text-paper"
                          : clip.kind === "fx"
                            ? "bg-raise text-copper"
                            : "bg-raise text-paper"
                  } ${selectedId === clip.id ? "outline outline-2 outline-copper" : ""}`}
                  style={{ left: clip.start * pps, width: Math.max(clip.duration * pps, 12) }}
                >
                  <span className="block truncate">{clip.name}</span>
                  <span
                    data-handle="1"
                    className="absolute top-0 right-0 h-full w-3 cursor-ew-resize bg-ink/30"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      const origin = event.clientX;
                      const dur0 = clip.duration;
                      const el = event.currentTarget;
                      el.setPointerCapture(event.pointerId);
                      const move = (ev: PointerEvent) => {
                        const next = Math.round((dur0 + (ev.clientX - origin) / pps) * 4) / 4;
                        setClipDuration(clip.id, Math.max(0.25, next));
                      };
                      const up = () => {
                        el.removeEventListener("pointermove", move);
                        el.removeEventListener("pointerup", up);
                      };
                      el.addEventListener("pointermove", move);
                      el.addEventListener("pointerup", up);
                    }}
                  />
                </div>
              ))}
          </div>
        ))}
        <div
          className="absolute top-0 bottom-0 z-10 w-4 -translate-x-1/2"
          style={{ left: playhead * pps }}
          onPointerDown={(event) => {
            event.stopPropagation();
            const origin = event.clientX;
            const start0 = playhead;
            const el = event.currentTarget;
            el.setPointerCapture(event.pointerId);
            setPlaying(false);
            const move = (ev: PointerEvent) => {
              setPlayhead(Math.max(0, Math.min(duration, start0 + (ev.clientX - origin) / pps)));
            };
            const up = () => {
              el.removeEventListener("pointermove", move);
              el.removeEventListener("pointerup", up);
            };
            el.addEventListener("pointermove", move);
            el.addEventListener("pointerup", up);
          }}
        >
          <div className="mx-auto h-full w-px bg-copper" />
        </div>
      </div>
    </div>
  );
}
