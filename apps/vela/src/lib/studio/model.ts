import { isMediaAsset, SH135_HASH, type FrameRate, type MediaAsset, type Track } from "./media-model";

export type Room = "bay" | "cut" | "score" | "still" | "title" | "board" | "script" | "mcp" | "stage" | "enhance" | "booth" | "floor";

export type Aspect = "16:9" | "9:16" | "1:1";

export type Preset = "youtube" | "reel" | "podcast" | "broadcast";

export type Motif =
  | "rain"
  | "lantern"
  | "hands"
  | "alley"
  | "steam"
  | "mic"
  | "wave"
  | "city"
  | "title";

export type ClipKind = "picture" | "title" | "score" | "voice" | "fx";

export type TitleStyle = "lower" | "center" | "end";

export type TitleMotion = "rise" | "snap" | "type";

export interface Clip {
  id: string;
  name: string;
  kind: ClipKind;
  track: Track;
  start: number;
  duration: number;
  motif: Motif;
  text?: string;
  sub?: string;
  style?: TitleStyle;
  motion?: TitleMotion;
  look?: Look;
  shot?: Shot;
  audioId?: string;
  mediaId?: string;
  sourceIn?: number;
  gainDb?: number;
  fadeIn?: number;
  fadeOut?: number;
  muted?: boolean;
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface Grade {
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  vignette: number;
  depth: number;
}

export interface Drums {
  kick: boolean[];
  snare: boolean[];
  hat: boolean[];
  perc: boolean[];
}

export interface Score {
  bpm: number;
  swing: number;
  drums: Drums;
  melody: number[];
}

export type Fill = "copper" | "paper" | "ink" | "mute" | "raise";

export type LayerKind = "block" | "type" | "ring" | "bar";

export type Mask = "none" | "round" | "soft";

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  opacity: number;
  fill: Fill;
  text: string;
  mask: Mask;
  font: "display" | "sans";
}

export interface TitleCard {
  id: string;
  text: string;
  sub: string;
  style: TitleStyle;
  motion: TitleMotion;
}

export interface BoardCard {
  id: string;
  act: 1 | 2 | 3;
  title: string;
  body: string;
}

export type Location = "market" | "alley" | "studio" | "void";

export type PropKind = "figure" | "lamp" | "crate" | "card" | "arch";

export interface StageProp {
  id: string;
  name: string;
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  pose: number;
}

export interface Stage {
  location: Location;
  backdrop: boolean;
  yaw: number;
  pitch: number;
  dolly: number;
  props: StageProp[];
}

export type SkinPass = "fix" | "unpolish" | "shine" | "retouch";

export type SkinArea = "all" | "face" | "eyes" | "mouth";

export interface Enhance {
  pass: SkinPass;
  area: SkinArea;
  texture: number;
  freckles: number;
  smoothness: number;
  detail: number;
  scale: 1 | 2;
}

export interface Likeness {
  plateId: string | null;
  identity: number;
  catchlight: number;
  iris: number;
  underEye: number;
  lip: number;
  warmth: number;
  presence: number;
  breath: number;
}

export type Shot = "close" | "medium" | "wide";

export type Look = "ink" | "paper" | "lamp";

export interface Take {
  id: string;
  speaker: string;
  line: string;
  voiceURI: string;
  rate: number;
  pitch: number;
  shot: Shot;
  look: Look;
  audioId?: string;
  duration?: number;
}

export interface Booth {
  takes: Take[];
  activeId: string | null;
}

export interface Project {
  id: string;
  name: string;
  logline: string;
  aspect: Aspect;
  preset: Preset;
  grade: Grade;
  clips: Clip[];
  captions: Caption[];
  score: Score;
  layers: Layer[];
  titles: TitleCard[];
  board: BoardCard[];
  script: string;
  stage: Stage;
  enhance: Enhance;
  booth: Booth;
  likeness: Likeness;
  fps?: FrameRate;
  media?: MediaAsset[];
  soloTrack?: Track | null;
}

export const ASPECT_RATIO: Record<Aspect, string> = {
  "16:9": "16 / 9",
  "9:16": "9 / 16",
  "1:1": "1 / 1",
};

export const PRESET_ASPECT: Record<Preset, Aspect> = {
  youtube: "16:9",
  reel: "9:16",
  podcast: "1:1",
  broadcast: "16:9",
};

export const PRESET_COPY: Record<Preset, { label: string; detail: string }> = {
  youtube: { label: "YouTube", detail: "16:9 landscape, longer hold on titles" },
  reel: { label: "Reel", detail: "9:16 vertical, tight type, short scenes" },
  podcast: { label: "Podcast", detail: "Square cover and a talking-bed edit" },
  broadcast: { label: "Broadcast", detail: "16:9, lower thirds, quieter grade" },
};

export function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function row(pattern: string): boolean[] {
  return pattern
    .slice(0, 16)
    .padEnd(16, "-")
    .split("")
    .map((c) => c === "x");
}

export function melody(pattern: string): number[] {
  return pattern
    .slice(0, 16)
    .padEnd(16, "0")
    .split("")
    .map((c) => {
      const n = Number(c);
      return Number.isFinite(n) ? n : 0;
    });
}

export function defaultLikeness(): Likeness {
  return { plateId: null, identity: 82, catchlight: 48, iris: 36, underEye: 22, lip: 30, warmth: 46, presence: 38, breath: 16 };
}

export function defaultGrade(): Grade {
  return { exposure: 0, contrast: 10, saturation: 4, warmth: 12, vignette: 32, depth: 28 };
}

export function defaultScore(): Score {
  return {
    bpm: 96,
    swing: 8,
    drums: {
      kick: row("x---x---x---x---"),
      snare: row("----x-------x---"),
      hat: row("x-x-x-x-x-x-x-x-"),
      perc: row("------x-------x-"),
    },
    melody: melody("1000300010005000"),
  };
}

export function projectDuration(project: Project): number {
  const clipEnd = project.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const capEnd = project.captions.reduce((max, cap) => Math.max(max, cap.end), 0);
  return Math.max(8, clipEnd, capEnd);
}

export function wordCount(script: string): number {
  return script.trim().match(/[A-Za-z0-9'’]+/g)?.length ?? 0;
}

export function fmt(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${f}`;
}

export function clipAt(clips: Clip[], track: Track, time: number): Clip | null {
  const hits = clips.filter(
    (clip) => clip.track === track && time >= clip.start && time < clip.start + clip.duration - 0.001,
  );
  return hits.at(-1) ?? null;
}

const FILLER =
  /\b(very|really|just|actually|basically|literally|kind of|sort of|a bit)\b/gi;

export function tightenScript(script: string): string {
  return script
    .replace(FILLER, "")
    .replace(/[ ]{2,}/g, " ")
    .replace(/ +([,.:;!?])/g, "$1")
    .replace(/[ ]+\n/g, "\n");
}

export function formatHeadings(script: string): string {
  return script
    .split("\n")
    .map((line) => (/^\s*(int|ext)\b/i.test(line) ? line.trim().toUpperCase() : line))
    .join("\n");
}

export function extractScenes(script: string): string[] {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(INT|EXT)\b/.test(line));
}

export function extractDialogue(script: string): string[] {
  return extractCues(script).map((cue) => cue.line);
}

export function extractCues(script: string): { speaker: string; line: string }[] {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const spoken: { speaker: string; line: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const next = lines[i + 1];
    if (/^(INT|EXT)\b/.test(line)) continue;
    if (/^[A-Z][A-Z0-9 .'’-]{1,28}$/.test(line) && next && !/^(INT|EXT)\b/.test(next)) {
      spoken.push({ speaker: line, line: next });
      i += 1;
    }
  }
  return spoken;
}

export function extractBeats(script: string): string[] {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const beats: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (/^(INT|EXT)\b/.test(line)) continue;
    if (/^[A-Z][A-Z0-9 .'’-]{1,28}$/.test(line)) {
      i += 1;
      continue;
    }
    beats.push(line);
  }
  return beats.slice(0, 9);
}

const SCENE_MOTIFS: Motif[] = ["rain", "lantern", "hands", "alley", "steam", "city", "wave", "mic"];

export function scenesToClips(scenes: string[]): Clip[] {
  return scenes.map((name, index) => ({
    id: uid("clip"),
    name: name.replace(/^(INT|EXT)\.?\s*/i, "").slice(0, 42),
    kind: "picture",
    track: 0,
    start: index * 4,
    duration: 4,
    motif: SCENE_MOTIFS[index % SCENE_MOTIFS.length] ?? "city",
  }));
}

export function speakLength(line: string, rate: number): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.max(1.5, Math.round((words / (2.4 * Math.max(rate, 0.5))) * 4) / 4);
}

export function dialogueToCaptions(lines: string[], duration: number): Caption[] {
  if (!lines.length) return [];
  const slice = Math.max(duration, lines.length * 2) / lines.length;
  return lines.map((text, index) => ({
    id: uid("cap"),
    start: Number((index * slice).toFixed(2)),
    end: Number((index * slice + Math.max(1.2, slice - 0.2)).toFixed(2)),
    text,
  }));
}

export function beatsToBoard(beats: string[]): BoardCard[] {
  if (!beats.length) return [];
  return beats.map((body, index) => {
    const act = (index < beats.length / 3 ? 1 : index < (2 * beats.length) / 3 ? 2 : 3) as 1 | 2 | 3;
    const title = body.split(" ").slice(0, 4).join(" ");
    return { id: uid("card"), act, title, body };
  });
}

export function layer(
  partial: Pick<Layer, "name" | "kind" | "x" | "y" | "w" | "h"> & Partial<Layer>,
): Layer {
  return {
    id: partial.id ?? uid("layer"),
    name: partial.name,
    kind: partial.kind,
    x: partial.x,
    y: partial.y,
    w: partial.w,
    h: partial.h,
    rotate: partial.rotate ?? 0,
    opacity: partial.opacity ?? 100,
    fill: partial.fill ?? "paper",
    text: partial.text ?? "",
    mask: partial.mask ?? "none",
    font: partial.font ?? "display",
  };
}

export function posterLayers(title: string, kicker: string): Layer[] {
  return [
    layer({
      name: "Field",
      kind: "block",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fill: "ink",
    }),
    layer({
      name: "Spine",
      kind: "bar",
      x: 0,
      y: 0,
      w: 7,
      h: 100,
      fill: "copper",
    }),
    layer({
      name: "Kicker",
      kind: "type",
      x: 14,
      y: 18,
      w: 74,
      h: 12,
      fill: "copper",
      text: kicker,
      font: "sans",
    }),
    layer({
      name: "Title",
      kind: "type",
      x: 14,
      y: 36,
      w: 78,
      h: 28,
      fill: "paper",
      text: title,
      font: "display",
    }),
  ];
}

export function templateLayers(kind: "podcast" | "launch" | "sports" | "thumb", title: string): Layer[] {
  if (kind === "launch") {
    return [
      layer({ name: "Field", kind: "block", x: 0, y: 0, w: 100, h: 100, fill: "paper" }),
      layer({
        name: "Mark",
        kind: "ring",
        x: 28,
        y: 12,
        w: 44,
        h: 40,
        fill: "copper",
      }),
      layer({
        name: "Title",
        kind: "type",
        x: 8,
        y: 58,
        w: 84,
        h: 22,
        fill: "ink",
        text: title,
      }),
      layer({
        name: "Rule",
        kind: "bar",
        x: 30,
        y: 84,
        w: 40,
        h: 2,
        fill: "copper",
      }),
    ];
  }
  if (kind === "sports") {
    return [
      layer({ name: "Field", kind: "block", x: 0, y: 0, w: 100, h: 100, fill: "ink" }),
      layer({
        name: "Slash",
        kind: "bar",
        x: -10,
        y: 42,
        w: 120,
        h: 16,
        rotate: -8,
        fill: "copper",
      }),
      layer({
        name: "Mark",
        kind: "type",
        x: 8,
        y: 8,
        w: 80,
        h: 28,
        fill: "paper",
        text: "01",
      }),
      layer({
        name: "Title",
        kind: "type",
        x: 8,
        y: 64,
        w: 84,
        h: 24,
        fill: "paper",
        text: title,
      }),
    ];
  }
  if (kind === "thumb") {
    return [
      layer({ name: "Field", kind: "block", x: 0, y: 0, w: 100, h: 100, fill: "raise" }),
      layer({
        name: "Scrim",
        kind: "block",
        x: 0,
        y: 58,
        w: 100,
        h: 42,
        fill: "ink",
        opacity: 88,
      }),
      layer({
        name: "Tick",
        kind: "bar",
        x: 6,
        y: 66,
        w: 16,
        h: 2,
        fill: "copper",
      }),
      layer({
        name: "Title",
        kind: "type",
        x: 6,
        y: 70,
        w: 88,
        h: 24,
        fill: "paper",
        text: title,
      }),
    ];
  }
  return posterLayers(title, "WEEKLY SIGNAL");
}

export function blankProject(name: string): Project {
  return {
    id: uid("project"),
    name,
    logline: "A new piece. Write a scene, then rebuild the cut from the headings.",
    aspect: "16:9",
    preset: "youtube",
    grade: defaultGrade(),
    clips: [
      {
        id: uid("clip"),
        name: "Open",
        kind: "picture",
        track: 0,
        start: 0,
        duration: 4,
        motif: "city",
      },
    ],
    captions: [],
    score: defaultScore(),
    layers: posterLayers(name, "VELA"),
    titles: [
      {
        id: uid("title"),
        text: name,
        sub: "A VELA PIECE",
        style: "center",
        motion: "rise",
      },
    ],
    board: [
      {
        id: uid("card"),
        act: 1,
        title: "Open",
        body: "What does the audience see before anyone speaks?",
      },
    ],
    script: `INT. WORKROOM - DAY\n\nA person sits with the cut still unfinished.\n\nMAKER\nStart with the picture, not the pitch.\n`,
    stage: defaultStage(),
    enhance: defaultEnhance(),
    booth: { takes: [], activeId: null },
    likeness: defaultLikeness(),
  };
}

function nightMarket(): Project {
  return {
    id: "night-market",
    name: "Night Market",
    logline: "Rain, lanterns, and a paper cup that knows the alley better than the runner does.",
    aspect: "16:9",
    preset: "youtube",
    grade: { exposure: -4, contrast: 16, saturation: -6, warmth: 18, vignette: 46, depth: 42 },
    clips: [
      { id: "nm-1", name: "Rain on awnings", kind: "picture", track: 0, start: 0, duration: 4, motif: "rain" },
      { id: "nm-2", name: "Lantern row", kind: "picture", track: 0, start: 4, duration: 3.5, motif: "lantern" },
      { id: "nm-3", name: "Vendor hands", kind: "picture", track: 0, start: 7.5, duration: 3, motif: "hands" },
      { id: "nm-4", name: "Alley cut", kind: "picture", track: 0, start: 10.5, duration: 3.5, motif: "alley" },
      { id: "nm-5", name: "Steam hold", kind: "picture", track: 0, start: 14, duration: 4, motif: "steam" },
      {
        id: "nm-t",
        name: "Lower third",
        kind: "title",
        track: 1,
        start: 1,
        duration: 3.5,
        motif: "title",
        text: "NIGHT MARKET",
        sub: "A short",
        style: "lower",
        motion: "rise",
      },
      {
        id: "nm-s",
        name: "Score bed",
        kind: "score",
        track: 2,
        start: 0,
        duration: 8,
        motif: "wave",
      },
    ],
    captions: [
      { id: "nm-c1", start: 4.2, end: 7.2, text: "Two for the price of staying." },
      { id: "nm-c2", start: 11, end: 14.2, text: "Steam hides the turn." },
    ],
    score: {
      bpm: 84,
      swing: 18,
      drums: {
        kick: row("x-------x----x--"),
        snare: row("----x-------x---"),
        hat: row("--x---x---x---x-"),
        perc: row("--------x-------"),
      },
      melody: melody("1000500030001000"),
    },
    layers: posterLayers("Night Market", "A SHORT"),
    titles: [
      { id: "nm-title", text: "NIGHT MARKET", sub: "A short", style: "lower", motion: "rise" },
      { id: "nm-end", text: "Stay for the steam", sub: "", style: "end", motion: "type" },
    ],
    board: [
      { id: "nm-b1", act: 1, title: "Rain first", body: "Awnings, no faces yet. The market is a sound before it is a place." },
      { id: "nm-b2", act: 1, title: "Lanterns", body: "A row of low lamps. Color arrives late." },
      { id: "nm-b3", act: 2, title: "The cup", body: "Hands wrap paper. The vendor does not look up." },
      { id: "nm-b4", act: 2, title: "The cut", body: "Someone runs the alley. We do not learn why." },
      { id: "nm-b5", act: 3, title: "Steam", body: "Hold until the figure is gone. End on weather." },
    ],
    script: `INT. NIGHT MARKET - NIGHT

Rain needles the awnings. Lanterns burn low.

VENDOR
Two for the price of staying.

EXT. ALLEY - NIGHT

A runner cuts between stalls. Steam hides the turn.

INT. STALL - NIGHT

Hands wrap a paper cup. The city keeps its secret.
`,
    stage: {
      location: "market",
      backdrop: true,
      yaw: -32,
      pitch: 18,
      dolly: -20,
      props: [
        { id: "nm-runner", name: "Runner", kind: "figure", x: 36, y: 0, z: 40, rotY: 24, scale: 1, pose: 68 },
        { id: "nm-lamp", name: "Lantern", kind: "lamp", x: -78, y: 0, z: -20, rotY: 0, scale: 1, pose: 50 },
        { id: "nm-stall", name: "Stall", kind: "crate", x: -16, y: 0, z: 90, rotY: -16, scale: 1.3, pose: 50 },
        { id: "nm-awning", name: "Awning", kind: "arch", x: 8, y: 0, z: 8, rotY: 0, scale: 1.5, pose: 50 },
      ],
    },
    enhance: { pass: "fix", area: "face", texture: 64, freckles: 34, smoothness: 12, detail: 42, scale: 1 },
    likeness: defaultLikeness(),
    booth: {
      takes: [
        {
          id: "nm-take",
          speaker: "VENDOR",
          line: "Two for the price of staying.",
          voiceURI: "",
          rate: 0.9,
          pitch: 0.85,
          shot: "medium",
          look: "lamp",
        },
      ],
      activeId: "nm-take",
    },
  };
}

function signalHour(): Project {
  return {
    id: "signal-hour",
    name: "Signal Hour",
    logline: "A weekly show about the noise under the work, cut for a square cover and a short open.",
    aspect: "1:1",
    preset: "podcast",
    grade: { exposure: 2, contrast: 8, saturation: 6, warmth: 4, vignette: 18, depth: 12 },
    clips: [
      { id: "sh-1", name: "Cold open", kind: "picture", track: 0, start: 0, duration: 3, motif: "mic" },
      { id: "sh-2", name: "Theme bed", kind: "picture", track: 0, start: 3, duration: 4, motif: "wave" },
      { id: "sh-3", name: "City sting", kind: "picture", track: 0, start: 7, duration: 3, motif: "city" },
      {
        id: "sh-t",
        name: "Show title",
        kind: "title",
        track: 1,
        start: 3,
        duration: 3,
        motif: "title",
        text: "SIGNAL HOUR",
        sub: "Episode open",
        style: "center",
        motion: "snap",
      },
    ],
    captions: [{ id: "sh-c1", start: 0.4, end: 2.8, text: "You are early. Good." }],
    score: {
      bpm: 104,
      swing: 6,
      drums: {
        kick: row("x---x---x---x---"),
        snare: row("----x-------x---"),
        hat: row("xxxxxxxxxxxxxxxx"),
        perc: row("--x---x---x---x-"),
      },
      melody: melody("3030503010005000"),
    },
    layers: templateLayers("podcast", "Signal Hour"),
    titles: [
      { id: "sh-title", text: "SIGNAL HOUR", sub: "Episode open", style: "center", motion: "snap" },
    ],
    board: [
      { id: "sh-b1", act: 1, title: "Cold open", body: "One sentence. No music yet." },
      { id: "sh-b2", act: 2, title: "Theme", body: "The loop enters under the host, not over them." },
      { id: "sh-b3", act: 3, title: "Sting", body: "City motif, then the first question." },
    ],
    script: `INT. BOOTH - NIGHT

A red lamp. A quiet room. The mic is already live.

HOST
You are early. Good.

The theme is a loop, not a song. Leave space for the guest.
`,
    stage: {
      location: "studio",
      backdrop: true,
      yaw: 18,
      pitch: 12,
      dolly: -10,
      props: [
        { id: "sh-host", name: "Host", kind: "figure", x: 0, y: 0, z: 36, rotY: 0, scale: 1, pose: 42 },
        { id: "sh-lamp", name: "Practical", kind: "lamp", x: -60, y: 0, z: 10, rotY: 0, scale: 0.9, pose: 50 },
        { id: "sh-card", name: "Cover", kind: "card", x: 70, y: 20, z: -10, rotY: -20, scale: 1.1, pose: 50 },
      ],
    },
    enhance: { pass: "retouch", area: "face", texture: 18, freckles: 6, smoothness: 72, detail: 14, scale: 1 },
    likeness: defaultLikeness(),
    booth: {
      takes: [
        {
          id: "sh-take",
          speaker: "HOST",
          line: "You are early. Good.",
          voiceURI: "",
          rate: 1,
          pitch: 1,
          shot: "close",
          look: "ink",
        },
      ],
      activeId: "sh-take",
    },
  };
}

export function seedProjects(): Project[] {
  return [nightMarket(), signalHour()];
}

export function defaultEnhance(): Enhance {
  return { pass: "fix", area: "face", texture: 0, freckles: 0, smoothness: 0, detail: 0, scale: 1 };
}

function isPlaceholderEnhance(enhance: Enhance | undefined): boolean {
  if (!enhance) return true;
  const legacy = enhance as Enhance & { sharpen?: number; denoise?: number; relight?: number };
  if (legacy.sharpen === 16 && legacy.denoise === 48) return true;
  if (legacy.sharpen === 8 && legacy.denoise === 70) return true;
  if (legacy.sharpen === 0 && legacy.denoise === 100 && enhance.detail === 0) return true;
  const base = defaultEnhance();
  return (
    enhance.pass === base.pass &&
    enhance.texture === 0 &&
    enhance.freckles === 0 &&
    enhance.smoothness === 0 &&
    enhance.detail === 0 &&
    enhance.scale === 1
  );
}

export function normalizeEnhance(value: Partial<Enhance> | undefined): Enhance {
  const base = defaultEnhance();
  if (!value) return base;
  const legacy = value as Partial<Enhance> & { sharpen?: number; denoise?: number };
  if (value.pass) return { ...base, ...value, scale: value.scale === 2 ? 2 : 1 };
  return {
    pass: "fix",
    area: "face",
    texture: legacy.sharpen ?? 0,
    freckles: 0,
    smoothness: typeof legacy.denoise === "number" ? Math.max(0, 100 - legacy.denoise) : 0,
    detail: value.detail ?? 0,
    scale: value.scale === 2 ? 2 : 1,
  };
}

export function defaultStage(): Stage {
  return { location: "void", backdrop: true, yaw: -24, pitch: 16, dolly: -30, props: [] };
}

function isPlaceholderStage(stage: Stage | undefined): boolean {
  if (!stage || !Array.isArray(stage.props)) return true;
  return stage.props.length === 0 && stage.location === "void" && stage.yaw === -24 && stage.pitch === 16 && stage.dolly === -30;
}

function seededLook(id: string): { stage: Stage; enhance: Enhance; booth: Booth } | null {
  if (id === "night-market") {
    const seeded = nightMarket();
    return { stage: seeded.stage, enhance: seeded.enhance, booth: seeded.booth };
  }
  if (id === "signal-hour") {
    const seeded = signalHour();
    return { stage: seeded.stage, enhance: seeded.enhance, booth: seeded.booth };
  }
  return null;
}

export function withStage(project: Project): Project {
  const seeded = seededLook(project.id);
  const stage =
    seeded && isPlaceholderStage(project.stage)
      ? seeded.stage
      : { ...defaultStage(), ...project.stage, props: Array.isArray(project.stage?.props) ? project.stage.props : [] };
  const enhance = seeded && isPlaceholderEnhance(project.enhance) ? seeded.enhance : normalizeEnhance(project.enhance);
  const booth =
    project.booth && Array.isArray(project.booth.takes)
      ? { takes: project.booth.takes, activeId: project.booth.activeId ?? project.booth.takes[0]?.id ?? null }
      : (seeded?.booth ?? { takes: [], activeId: null });
  const likeness = { ...defaultLikeness(), ...project.likeness };
  return { ...project, stage, enhance, booth, likeness, fps: project.fps ?? 24,
    media: (project.media ?? []).map((asset) => ({ ...asset, locked: asset.sha256 === SH135_HASH || asset.locked })) };
}

export const LOCATION_MOTIF: Record<Location, Motif> = {
  market: "lantern",
  alley: "alley",
  studio: "mic",
  void: "city",
};

export const LOCATION_LABEL: Record<Location, string> = {
  market: "Night market",
  alley: "Alley",
  studio: "Studio",
  void: "Void",
};

export const PROP_LABEL: Record<PropKind, string> = {
  figure: "Figure",
  lamp: "Lamp",
  crate: "Crate",
  card: "Card",
  arch: "Arch",
};

export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    typeof project.script === "string" &&
    (project.fps === undefined || [24, 25, 30, 50, 60].includes(project.fps)) &&
    (project.media === undefined || (Array.isArray(project.media) && project.media.every(isMediaAsset))) &&
    (project.soloTrack == null || [0, 1, 2, 3, 4, 5, 6, 7].includes(project.soloTrack)) &&
    Array.isArray(project.clips) &&
    Array.isArray(project.layers) &&
    Array.isArray(project.captions) &&
    !!project.score &&
    !!project.grade
  );
}

export const NOTE_NAMES = ["–", "A", "C", "D", "E", "G", "A+", "C+", "D+"];

export const MOTIF_LABEL: Record<Motif, string> = {
  rain: "Rain",
  lantern: "Lanterns",
  hands: "Hands",
  alley: "Alley",
  steam: "Steam",
  mic: "Mic",
  wave: "Wave",
  city: "City",
  title: "Title",
};
