export type ModuleStatus = "operational" | "planner" | "bridge" | "ai-media";

export type StudioModule = {
  id: string;
  dept: string;
  label: string;
  href: string;
  status: ModuleStatus;
  studioRole: string;
};

/**
 * Hub badges. Ready is never Live.
 *
 * Ready  = the surface does operator work (queue, review, grade, encode).
 * Board  = a file editor for its real scope (cues → SRT, spec → JSON),
 *          or a sketch/reference. Not Premiere, Fairlight, Fusion, or DaVinci.
 * Bridge = file handoff, not a running engine.
 * AI media = JobRunner path (mock or live).
 *
 * Live is reserved for a real provider run (JobRunner / job.mode).
 */
export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = {
  operational: "Ready",
  planner: "Board",
  bridge: "Bridge",
  "ai-media": "AI media",
};

export const MODULE_STATUS_TONE: Record<ModuleStatus, "neutral" | "outline" | "accent" | "quiet"> = {
  operational: "neutral",
  planner: "quiet",
  bridge: "outline",
  "ai-media": "accent",
};

/** Surfaces that look like product but are sample/static. Must stay Board. */
export const BOARD_MODULE_IDS = [
  "pipeline",
  "script",
  "archive",
  "captions",
  "titles",
  "presets",
  "audio",
  "vfx",
  "timeline",
  "collab",
  "hardware",
  "longform",
  "assets",
  "export",
] as const;

export const STUDIO_MODULES: StudioModule[] = [
  { id: "pipeline", dept: "Production", label: "Pipeline", href: "/pipeline", status: "planner", studioRole: "Stage map — sample board, not a running pipeline" },
  { id: "projects", dept: "Production", label: "Projects / bins", href: "/projects", status: "operational", studioRole: "Cut tracking" },
  { id: "dailies", dept: "Production", label: "Dailies", href: "/dailies", status: "operational", studioRole: "Day roll queue" },
  { id: "script", dept: "Development", label: "Script notes", href: "/script", status: "planner", studioRole: "Edit beats, emit JSON — not a screenplay tool" },
  { id: "nle", dept: "Editorial", label: "NLE bridge", href: "/nle", status: "bridge", studioRole: "CMX3600 EDL handoff — not AAF/XML" },
  { id: "timeline", dept: "Editorial", label: "Timeline", href: "/timeline", status: "planner", studioRole: "Assembly sketch — read-only, not an NLE" },
  { id: "color", dept: "Color", label: "Restraint grade", href: "/color", status: "operational", studioRole: "Restraint envelope + still preview — not Resolve" },
  { id: "audio", dept: "Sound", label: "Audio hierarchy", href: "/audio", status: "planner", studioRole: "Edit ladder rules, emit law — not Fairlight" },
  { id: "mix", dept: "Sound", label: "Mix bridge", href: "/mix", status: "bridge", studioRole: "Mix session dump — not Fairlight" },
  { id: "voice", dept: "AI Media", label: "Voice clone / TTS", href: "/voice", status: "ai-media", studioRole: "ElevenLabs wired · mock default" },
  { id: "avatar", dept: "AI Media", label: "Avatar / talking head", href: "/avatar", status: "ai-media", studioRole: "HeyGen wired · mock default" },
  { id: "gen-video", dept: "AI Media", label: "Gen video", href: "/gen-video", status: "ai-media", studioRole: "Runway text-to-video · others refuse" },
  { id: "longform", dept: "Deliverables", label: "Long-form render", href: "/longform", status: "planner", studioRole: "Sample stitch plan — not a running episode renderer" },
  { id: "stock", dept: "Library", label: "Stock library", href: "/stock", status: "operational", studioRole: "Licensed index — not live Artlist search" },
  { id: "captions", dept: "Finishing", label: "Captions", href: "/captions", status: "planner", studioRole: "Edit cues, emit SRT/VTT — not a live captioner" },
  { id: "titles", dept: "Finishing", label: "Titles", href: "/titles", status: "planner", studioRole: "Edit spec, emit JSON — not After Effects" },
  { id: "vfx", dept: "VFX", label: "VFX board", href: "/vfx", status: "planner", studioRole: "Shot tracker" },
  { id: "vfx-engine", dept: "VFX", label: "VFX engine bridge", href: "/vfx-engine", status: "bridge", studioRole: "Node graph JSON — not Fusion" },
  { id: "assets", dept: "MAM", label: "Assets", href: "/assets", status: "planner", studioRole: "Catalog index of names — not Drive/S3" },
  { id: "mam", dept: "MAM", label: "MAM bridge", href: "/mam", status: "bridge", studioRole: "Catalog export — not Drive/S3" },
  { id: "review", dept: "QC", label: "Review", href: "/review", status: "operational", studioRole: "Frame notes" },
  { id: "rubric", dept: "QC", label: "Rubric", href: "/rubric", status: "operational", studioRole: "Ship gate" },
  { id: "export", dept: "Deliverables", label: "Export", href: "/export", status: "planner", studioRole: "Format matrix as a file — encode lives on /jobs" },
  { id: "jobs", dept: "Deliverables", label: "Transcode", href: "/jobs", status: "operational", studioRole: "ffmpeg queue" },
  { id: "render", dept: "Deliverables", label: "Render farm", href: "/render", status: "bridge", studioRole: "ffmpeg-plan JSON — farm executes elsewhere" },
  { id: "presets", dept: "Brand", label: "Lane presets", href: "/presets", status: "planner", studioRole: "Edit lane notes, emit JSON — not a LUT engine" },
  { id: "archive", dept: "Archive", label: "Archive", href: "/archive", status: "planner", studioRole: "Checklist board — not a live archive" },
  { id: "collab", dept: "Studio", label: "Collaboration", href: "/collab", status: "planner", studioRole: "Role agreement — per-role auth is not code" },
  { id: "hardware", dept: "Infrastructure", label: "Hardware reference", href: "/hardware", status: "planner", studioRole: "Reference classes — not a live inventory" },
];

export function modulesByDept(): Record<string, StudioModule[]> {
  const map: Record<string, StudioModule[]> = {};
  for (const m of STUDIO_MODULES) {
    (map[m.dept] ||= []).push(m);
  }
  return map;
}

/** Surfaces that do operator work (queue, review, grade, encode). Never Boards or Bridges. */
export function workingSurfaces(): StudioModule[] {
  return STUDIO_MODULES.filter((m) => m.status === "operational");
}
