import type { TimelineClip } from "./timeline";
import { AUDIO_HIERARCHY } from "./audio";
import { buildExportCommand, buildProxyCommand, canRun } from "./ffmpeg";
import { DELIVERABLES } from "./pipeline";

/**
 * What actually crosses a bridge.
 *
 * Every bridge page described an "Out" contract and then produced nothing, so
 * the contract was a caption. These builders are that contract in the format the
 * engine on the far side reads: an EDL a conform tool will load, a stem sheet a
 * mixer can work from, a shot package a compositor can open.
 *
 * All of them are pure — string in, string out. A handoff artifact that can only
 * be judged by opening Resolve is a handoff artifact nobody checks.
 */

/**
 * Whole-number timebases only.
 *
 * 23.976 and 29.97 need drop-frame arithmetic to stay locked to wall clock over
 * a long programme, and a non-drop timecode silently labelled as one of those
 * rates drifts ~3.6s per hour — the kind of error that surfaces at the deliverable
 * stage. Offering only the rates we compute correctly is the honest option.
 */
export type Timebase = 24 | 25 | 30;

export const TIMEBASES: Timebase[] = [24, 25, 30];

/** SMPTE non-drop timecode. Wraps at 24h, as timecode does. */
export function toTimecode(seconds: number, fps: Timebase): string {
  const frames = toFrames(seconds, fps);
  const ff = frames % fps;
  const totalSeconds = Math.floor(frames / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600) % 24;
  return [hh, mm, ss, ff].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * The frame a moment falls on.
 *
 * Floor, not round: at 25fps, frame 38 spans 1.52s–1.56s, so rounding 1.5s up to
 * frame 38 names a frame that does not contain the moment asked about. Every
 * clip boundary would land one frame late, which is a black flash at a cut.
 *
 * The epsilon absorbs binary float error — a duration meant as 3.0 that arrives
 * as 2.9999999999999996 must still be 75 frames at 25fps, not 74.
 */
export function toFrames(seconds: number, fps: Timebase): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(0, Math.floor(seconds * fps + 1e-6));
}

/**
 * A CMX3600 EDL for the picture cut.
 *
 * Picture only, on purpose. Audio leaves as stems from /mix — that is how a post
 * chain actually splits, and it is what the mix bridge already claims. Writing
 * four audio tracks into an EDL would mean claiming CMX channel assignments the
 * format only partly supports, and the mixer would ignore the result anyway.
 *
 * Source timecode is zero-based per clip: this timeline holds file-based media
 * with no camera timecode, so the conform is by clip name, and saying otherwise
 * would send an assistant hunting for reels that do not exist.
 */
export function buildEDL(opts: { title: string; clips: TimelineClip[]; fps: Timebase }): string {
  const { title, clips, fps } = opts;

  const video = clips
    .filter((c) => c.track === "video" && c.durationSec > 0)
    .sort((a, b) => a.startSec - b.startSec);

  const lines = [
    `TITLE: ${sanitizeTitle(title)}`,
    "FCM: NON-DROP FRAME",
    `* TIMEBASE: ${fps} FPS`,
    // ASCII only in the lines we generate: EDL parsers are decades old and some
    // read the file as plain ASCII. Clip names are left exactly as they are —
    // they are the conform key, and transliterating one would break the match.
    "* PICTURE ONLY - AUDIO CONFORMS FROM THE STEM SHEET",
    "* SOURCE TIMECODE IS ZERO-BASED; CONFORM BY CLIP NAME",
  ];

  video.forEach((clip, i) => {
    const event = String(i + 1).padStart(3, "0");
    const srcIn = toTimecode(0, fps);
    const srcOut = toTimecode(clip.durationSec, fps);
    const recIn = toTimecode(clip.startSec, fps);
    const recOut = toTimecode(clip.startSec + clip.durationSec, fps);
    // CMX3600 column layout: event, reel (8), channel (4), transition (9).
    // AX is the standard reel name for an auxiliary/unknown source.
    lines.push(`${event}  ${"AX".padEnd(8)} ${"V".padEnd(4)} ${"C".padEnd(8)} ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    lines.push(`* FROM CLIP NAME: ${sanitizeComment(clip.label)}`);
  });

  if (video.length === 0) lines.push("* NO PICTURE EVENTS");

  return lines.join("\n") + "\n";
}

/**
 * The stem sheet, derived from the hierarchy on /audio rather than restated.
 *
 * The mix bridge says that hierarchy "is law — the mix realises it, it does not
 * renegotiate it". That is only true if the sheet the mixer receives is generated
 * from it, so a change on /audio reaches the mix and a second copy cannot drift.
 */
export function buildStemSheet(opts: {
  title: string;
  clips: TimelineClip[];
  target: LoudnessTarget;
}): string {
  const { title, clips, target } = opts;
  const rows = [
    ["stem", "priority", "rule", "timeline_track", "clips", "duration_sec", "integrated_lufs", "true_peak_dbtp"],
  ];

  for (const level of AUDIO_HIERARCHY) {
    const own = clips.filter((c) => c.track === level.track);
    const seconds = own.reduce((sum, c) => sum + c.durationSec, 0);
    rows.push([
      level.name,
      String(level.level),
      level.rule,
      level.track,
      String(own.length),
      seconds.toFixed(2),
      // Only the dialogue anchor carries the programme target; a music bed
      // printed at the anchor would be competing with the voice by definition.
      level.level === 1 ? String(target.integratedLufs) : "stem — no independent target",
      String(target.truePeakDbtp),
    ]);
  }

  return [
    `# STEM SHEET — ${sanitizeComment(title)}`,
    `# NOTICE: File handoff — not Fairlight, not Pro Tools, not a mixer. Hierarchy from /audio.`,
    `# DELIVERY: ${target.label}`,
    ...rows.map(toCsvRow),
  ].join("\n") + "\n";
}

export type LoudnessTarget = {
  id: string;
  label: string;
  integratedLufs: number;
  truePeakDbtp: number;
};

/** Anchors from docs/HARDWARE.md's mix law — one source, not a retyped pair. */
export const LOUDNESS_TARGETS: LoudnessTarget[] = [
  { id: "shortform", label: "Short-form / social", integratedLufs: -16, truePeakDbtp: -1 },
  { id: "broadcast", label: "Broadcast deliverable", integratedLufs: -23, truePeakDbtp: -1 },
];

/**
 * A shot package manifest for comp and 3D.
 *
 * Frame ranges, not seconds: a compositor works in frames, and asking them to
 * convert is how an off-by-one at the head of a shot gets introduced. Ranges are
 * inclusive of the first frame and exclusive of the last, stated explicitly in
 * the manifest so nobody has to guess which convention was meant.
 */
export function buildShotPackage(opts: {
  title: string;
  clips: TimelineClip[];
  fps: Timebase;
  colorSpace: string;
  /**
   * The VFX board's entries for this cut. A compositor opening a package with
   * no board state has no way to know a shot is already someone's work in
   * progress, which is how two people comp the same plate.
   */
  board?: { id: string; desc: string; status: string; engine: string; note?: string }[];
}): string {
  const { title, clips, fps, colorSpace, board } = opts;
  const shots = clips
    .filter((c) => c.track === "video" && c.durationSec > 0)
    .sort((a, b) => a.startSec - b.startSec)
    .map((c, i) => ({
      shotId: `${slug(title)}_${String((i + 1) * 10).padStart(4, "0")}`,
      plate: c.label,
      clipId: c.id,
      firstFrame: toFrames(c.startSec, fps),
      lastFrameExclusive: toFrames(c.startSec + c.durationSec, fps),
      frameCount: toFrames(c.startSec + c.durationSec, fps) - toFrames(c.startSec, fps),
      recordIn: toTimecode(c.startSec, fps),
      colorSpace,
    }));

  return (
    JSON.stringify(
      {
        title,
        notice:
          "Shot package JSON — not Fusion, not After Effects, not a compositor. Frame ranges for a compositor to open.",
        fps,
        frameRangeConvention: "firstFrame inclusive, lastFrameExclusive exclusive",
        colorSpace,
        deliverBack: "EXR sequence or pre-comp, conformed to the plate colour space",
        shots,
        // Omitted rather than sent empty: an empty array reads as "the board is
        // clear", which is a different claim from "no board was consulted".
        ...(board && board.length > 0
          ? { board: board.map((b) => ({ id: b.id, desc: b.desc, status: b.status, engine: b.engine, note: b.note })) }
          : {}),
      },
      null,
      2
    ) + "\n"
  );
}

/**
 * The storage path contract.
 *
 * Three tiers named separately, because "where is the master" is the question a
 * MAM exists to answer and a single path cannot answer it. Deterministic from the
 * cut id, so the same cut resolves to the same paths from any surface.
 */
export function buildPathContract(opts: {
  cutId: string;
  title: string;
  /** Catalog names from /assets. Omitted when the index was not consulted. */
  index?: { name: string; type: string; location?: string }[];
}): string {
  const { cutId, title, index } = opts;
  const key = slug(title) || slug(cutId) || "untitled";
  const base = `${cutId}/${key}`;
  return (
    JSON.stringify(
      {
        cutId,
        title,
        notice:
          "Path contract JSON with invented canonical paths. Not Drive, not S3, not Frame.io. This file names the tiers; it does not move media.",
        tiers: {
          online: { path: `online/${base}/`, role: "Working media on shared storage — edit and grade read from here" },
          nearline: { path: `nearline/${base}/`, role: "Completed masters, retrievable in minutes" },
          archive: { path: `archive/${base}/`, role: "Cold copy — 3-2-1: two media types, one geo-separated" },
        },
        rules: [
          "Paths are canonical names, not live connections",
          "The /archive board is a sample checklist — this file does not enforce it",
          "Checksums are a mover's job; this file does not write them",
        ],
        ...(index && index.length > 0
          ? { index: index.map((a) => ({ name: a.name, type: a.type, location: a.location ?? "" })) }
          : {}),
      },
      null,
      2
    ) + "\n"
  );
}

function toCsvRow(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

/** Quote anything that would otherwise break the row apart. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** EDL titles are a single line; a newline would start a bogus record. */
function sanitizeTitle(title: string): string {
  return title.replace(/[\r\n]+/g, " ").trim().slice(0, 70) || "UNTITLED";
}

function sanitizeComment(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}


/**
 * The ffmpeg plan that crosses the render-farm bridge.
 *
 * A plan, not an encode. The farm (or a local worker) runs it after a human
 * confirms. Export-class plans stay blocked in the file itself when the cut
 * has no recorded rubric pass — the download is still the artifact.
 */
export function buildRenderPlan(opts: {
  cutId: string;
  title: string;
  kind: "proxy" | "export";
  inputPath?: string;
  outputPath?: string;
  rubricPass: boolean;
  assemblySource: string;
}): string {
  const inputPath = opts.inputPath || "input.mp4";
  const outputPath = opts.outputPath || (opts.kind === "export" ? "master.mp4" : "proxy.mp4");
  const plan =
    opts.kind === "export" ? buildExportCommand(inputPath, outputPath) : buildProxyCommand(inputPath, outputPath);
  const allowed = opts.kind === "export" ? canRun(plan, opts.rubricPass) : true;
  return (
    JSON.stringify(
      {
        handoff: "render-farm",
        notice:
          "This file is a plan for the encode farm, not an executed render and not an engine. The farm runs it after a human confirms.",
        cutId: opts.cutId,
        title: opts.title,
        assemblySource: opts.assemblySource,
        kind: opts.kind,
        plan,
        matrix: DELIVERABLES.map((d) => ({ id: d.id, label: d.label, width: d.width, height: d.height })),
        allowed,
        reason: allowed
          ? opts.kind === "export"
            ? `Authorised by the recorded rubric pass on "${opts.title}" — run after human confirm`
            : "Proxy — ungated. The farm runs this after a human confirms"
          : `Blocked: "${opts.title}" has no recorded rubric pass`,
      },
      null,
      2
    ) + "\n"
  );
}


/**
 * Mix session dump — the ladder, the clips on each stem, the loudness law.
 * A mixer opens this; Fairlight is not this page.
 */
export function buildMixSession(opts: {
  title: string;
  clips: TimelineClip[];
  target: LoudnessTarget;
}): string {
  const { title, clips, target } = opts;
  const stems = AUDIO_HIERARCHY.map((level) => {
    const own = clips.filter((c) => c.track === level.track);
    return {
      stem: level.name,
      priority: level.level,
      rule: level.rule,
      track: level.track,
      clips: own.map((c) => ({ id: c.id, label: c.label, startSec: c.startSec, durationSec: c.durationSec })),
      durationSec: Number(own.reduce((sum, c) => sum + c.durationSec, 0).toFixed(2)),
      integratedLufs: level.level === 1 ? target.integratedLufs : null,
      truePeakDbtp: target.truePeakDbtp,
    };
  });
  return (
    JSON.stringify(
      {
        kind: "mix-session",
        notice:
          "Mix session dump. Not Fairlight, not Pro Tools, not a mixer. Hierarchy from /audio; this file realises it.",
        title,
        delivery: { id: target.id, label: target.label, integratedLufs: target.integratedLufs, truePeakDbtp: target.truePeakDbtp },
        stems,
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * Catalog export for the MAM bridge.
 * Names and filed paths from /assets — not Drive, not S3, not Frame.io.
 */
export function buildCatalogExport(opts: {
  assets: { name: string; type: string; tags?: string[]; location?: string }[];
  title?: string;
}): string {
  return (
    JSON.stringify(
      {
        kind: "catalog-export",
        notice:
          "Catalog export of names and filed paths. Not Drive, not S3, not Frame.io. This file does not move media. The /archive board is a sample checklist — this file does not enforce it.",
        title: opts.title || "Asset catalog",
        assets: opts.assets.map((a) => ({
          name: a.name,
          type: a.type,
          tags: a.tags ?? [],
          location: a.location ?? "",
        })),
      },
      null,
      2,
    ) + "\n"
  );
}

/**
 * A compositor node graph: one Loader per plate, a Merge chain, a Saver.
 * Frame ranges, not pixels. Not Fusion, not After Effects.
 */
export function buildNodeGraph(opts: {
  title: string;
  clips: TimelineClip[];
  fps: Timebase;
  board?: { id: string; desc: string; status: string; engine: string; note?: string }[];
}): string {
  const { title, clips, fps, board } = opts;
  const plates = clips
    .filter((c) => c.track === "video" && c.durationSec > 0)
    .sort((a, b) => a.startSec - b.startSec);

  const nodes: Record<string, unknown>[] = [];
  const edges: { from: string; to: string; fromPort: string; toPort: string }[] = [];

  plates.forEach((c, i) => {
    const loaderId = `Loader_${String(i + 1).padStart(2, "0")}`;
    nodes.push({
      id: loaderId,
      type: "Loader",
      plate: c.label,
      clipId: c.id,
      firstFrame: toFrames(c.startSec, fps),
      lastFrameExclusive: toFrames(c.startSec + c.durationSec, fps),
    });
    const mergeId = i === 0 ? "Merge_01" : `Merge_${String(i + 1).padStart(2, "0")}`;
    if (i === 0) {
      nodes.push({ id: mergeId, type: "Merge", note: "Background plate" });
      edges.push({ from: loaderId, to: mergeId, fromPort: "output", toPort: "background" });
    } else {
      nodes.push({ id: mergeId, type: "Merge", note: "Over previous" });
      edges.push({ from: loaderId, to: mergeId, fromPort: "output", toPort: "foreground" });
      edges.push({
        from: i === 1 ? "Merge_01" : `Merge_${String(i).padStart(2, "0")}`,
        to: mergeId,
        fromPort: "output",
        toPort: "background",
      });
    }
  });

  nodes.push({
    id: "Saver_01",
    type: "Saver",
    format: "EXR sequence",
    colorSpace: "ACEScct",
    note: "Conformed to the plate colour space",
  });
  if (plates.length > 0) {
    const lastMerge = `Merge_${String(plates.length).padStart(2, "0")}`;
    edges.push({ from: lastMerge, to: "Saver_01", fromPort: "output", toPort: "input" });
  }

  return (
    JSON.stringify(
      {
        kind: "vfx-node-graph",
        notice:
          "Compositor node graph JSON — Loaders, Merges, Saver. Not Fusion, not After Effects, not a running comp. Frame ranges for a compositor to rebuild.",
        title,
        fps,
        frameRangeConvention: "firstFrame inclusive, lastFrameExclusive exclusive",
        nodes,
        edges,
        ...(board && board.length > 0
          ? { board: board.map((b) => ({ id: b.id, desc: b.desc, status: b.status, engine: b.engine, note: b.note })) }
          : {}),
      },
      null,
      2,
    ) + "\n"
  );
}
