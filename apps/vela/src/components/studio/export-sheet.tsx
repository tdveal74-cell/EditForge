import { X } from "lucide-react";
import { useState } from "react";
import { createProjectBundle, downloadBundle } from "@/lib/studio/project-bundle";
import { Btn } from "@/components/studio/controls";
import { fmt, PRESET_COPY, projectDuration, type Preset, type Project } from "@/lib/studio/model";
import { useProject, useStudio } from "@/lib/studio/store";

const PRESETS: Preset[] = ["youtube", "reel", "podcast", "broadcast"];

const MOTIF_INK: Record<string, string> = {
  rain: "#243044",
  lantern: "#d4894a",
  hands: "#f3eee4",
  alley: "#2a2b24",
  steam: "#8d877c",
  mic: "#d4894a",
  wave: "#c98448",
  city: "#3a3b32",
  title: "#f3eee4",
};

export function ExportSheet() {
  const project = useProject();
  const setPreset = useStudio((state) => state.setPreset);
  const setExportOpen = useStudio((state) => state.setExportOpen);
  const flash = useStudio((state) => state.flash);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 p-3 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-line bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl">Package</h2>
            <p className="mt-1 text-sm text-pretty text-mute">
              Back up the project with its original media, or download metadata only. The contact sheet is a still of the cut, not a rendered movie.
            </p>
          </div>
          <button type="button" aria-label="Close" className="inline-flex size-11 items-center justify-center" onClick={() => setExportOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-2">
          {PRESETS.map((preset) => {
            const copy = PRESET_COPY[preset];
            const on = project.preset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setPreset(preset)}
                className={`rounded-md border px-3 py-3 text-left ${on ? "border-copper bg-raise" : "border-line"}`}
              >
                <span className="block text-sm text-paper">{copy.label}</span>
                <span className="block text-xs text-mute">{copy.detail}</span>
              </button>
            );
          })}
        </div>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Runtime</span>
            <span className="tabular-nums">{fmt(projectDuration(project))}</span>
          </li>
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Frame</span>
            <span>{project.aspect}</span>
          </li>
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Captions</span>
            <span className="tabular-nums">{project.captions.length}</span>
          </li>
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Tempo</span>
            <span className="tabular-nums">{project.score.bpm}</span>
          </li>
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Stage</span>
            <span className="tabular-nums">{project.stage.props.length} props</span>
          </li>
          <li className="rounded-md bg-ink px-3 py-2">
            <span className="block text-xs text-mute">Skin</span>
            <span className="capitalize">{project.enhance.pass}</span>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Btn tone="copper" disabled={busy} onClick={() => {
            setBusy(true);
            void createProjectBundle(project).then((blob) => { downloadBundle(project.name, blob); flash("Project and original media packaged. Test a restore before relying on a backup."); })
              .catch((error) => flash(String(error.message ?? error))).finally(() => setBusy(false));
          }}>{busy ? "Packing original media…" : "Project + media backup"}</Btn>
          <Btn tone="copper" onClick={() => downloadProject(project)}>
            Metadata only
          </Btn>
          <Btn onClick={() => downloadSheet(project)}>Contact sheet</Btn>
        </div>
      </div>
    </div>
  );
}

function downloadProject(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(project.name)}.vela.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSheet(project: Project) {
  const scale = project.enhance.scale === 2 ? 2 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = 1600 * scale;
  canvas.height = 900 * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  const ink = cssColor("--color-ink", "#10110e");
  const paper = cssColor("--color-paper", "#f3eee4");
  const copper = cssColor("--color-copper", "#d4894a");
  const mute = cssColor("--color-mute", "#a39c8e");
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, 1600, 900);
  ctx.fillStyle = copper;
  ctx.fillRect(0, 0, 28, 900);
  ctx.fillStyle = copper;
  ctx.font = "500 28px Outfit, sans-serif";
  ctx.fillText("VELA", 72, 80);
  ctx.fillStyle = paper;
  ctx.font = "72px Instrument Serif, serif";
  ctx.fillText(project.name, 72, 180);
  ctx.fillStyle = mute;
  ctx.font = "28px Outfit, sans-serif";
  wrapText(ctx, project.logline, 72, 240, 980, 40);
  const pictures = project.clips.filter((clip) => clip.kind === "picture").slice(0, 6);
  pictures.forEach((clip, index) => {
    const x = 72 + index * 240;
    ctx.fillStyle = MOTIF_INK[clip.motif] ?? copper;
    ctx.fillRect(x, 420, 210, 280);
    ctx.fillStyle = ink;
    ctx.font = "24px Outfit, sans-serif";
    ctx.fillText(clip.name.slice(0, 18), x + 16, 660);
  });
  ctx.fillStyle = paper;
  ctx.font = "24px Outfit, sans-serif";
  ctx.fillText(`${project.aspect}  ·  ${project.preset}  ·  ${fmt(projectDuration(project))}  ·  ${project.score.bpm} bpm`, 72, 820);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(project.name)}-sheet.png`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

function cssColor(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(" ");
  let row = "";
  let cursor = y;
  for (const word of words) {
    const trial = row ? `${row} ${word}` : word;
    if (ctx.measureText(trial).width > max) {
      ctx.fillText(row, x, cursor);
      row = word;
      cursor += line;
    } else row = trial;
  }
  if (row) ctx.fillText(row, x, cursor);
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vela";
}
