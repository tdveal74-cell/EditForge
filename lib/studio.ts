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
 * Hub badges. Operational means the surface is ready to use — never "Live".
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

export const STUDIO_MODULES: StudioModule[] = [
  { id: "pipeline", dept: "Production", label: "Pipeline", href: "/pipeline", status: "operational", studioRole: "Stage map ingest → deliver" },
  { id: "projects", dept: "Production", label: "Projects / bins", href: "/projects", status: "operational", studioRole: "Cut tracking" },
  { id: "dailies", dept: "Production", label: "Dailies", href: "/dailies", status: "operational", studioRole: "Day roll queue" },
  { id: "script", dept: "Development", label: "Script notes", href: "/script", status: "operational", studioRole: "Scene / continuity" },
  { id: "nle", dept: "Editorial", label: "NLE bridge", href: "/nle", status: "bridge", studioRole: "Resolve · Premiere · FCP handoff" },
  { id: "timeline", dept: "Editorial", label: "Timeline", href: "/timeline", status: "operational", studioRole: "Assembly sketch" },
  { id: "color", dept: "Color", label: "Restraint grade", href: "/color", status: "operational", studioRole: "Envelope + Resolve bridge" },
  { id: "audio", dept: "Sound", label: "Audio hierarchy", href: "/audio", status: "planner", studioRole: "VO / music / SFX law — sample board" },
  { id: "mix", dept: "Sound", label: "Mix bridge", href: "/mix", status: "bridge", studioRole: "Fairlight · Pro Tools stems" },
  { id: "voice", dept: "AI Media", label: "Voice clone / TTS", href: "/voice", status: "ai-media", studioRole: "ElevenLabs-class VO" },
  { id: "avatar", dept: "AI Media", label: "Avatar / talking head", href: "/avatar", status: "ai-media", studioRole: "HeyGen talking head" },
  { id: "gen-video", dept: "AI Media", label: "Gen video", href: "/gen-video", status: "ai-media", studioRole: "Runway wired · others refuse" },
  { id: "longform", dept: "Deliverables", label: "Long-form render", href: "/longform", status: "operational", studioRole: "Chapters · stitch · episode master" },
  { id: "stock", dept: "Library", label: "Stock library", href: "/stock", status: "operational", studioRole: "Licensed index — not live Artlist search" },
  { id: "captions", dept: "Finishing", label: "Captions", href: "/captions", status: "planner", studioRole: "SRT sample board" },
  { id: "titles", dept: "Finishing", label: "Titles", href: "/titles", status: "planner", studioRole: "Minimal card board" },
  { id: "vfx", dept: "VFX", label: "VFX board", href: "/vfx", status: "planner", studioRole: "Shot tracker" },
  { id: "vfx-engine", dept: "VFX", label: "VFX engine bridge", href: "/vfx-engine", status: "bridge", studioRole: "Fusion · AE · 3D" },
  { id: "assets", dept: "MAM", label: "Assets", href: "/assets", status: "operational", studioRole: "Catalog index" },
  { id: "mam", dept: "MAM", label: "MAM bridge", href: "/mam", status: "bridge", studioRole: "Drive · S3 · Frame.io" },
  { id: "review", dept: "QC", label: "Review", href: "/review", status: "operational", studioRole: "Frame notes" },
  { id: "rubric", dept: "QC", label: "Rubric", href: "/rubric", status: "operational", studioRole: "Ship gate" },
  { id: "export", dept: "Deliverables", label: "Export", href: "/export", status: "operational", studioRole: "Format matrix" },
  { id: "jobs", dept: "Deliverables", label: "Transcode", href: "/jobs", status: "operational", studioRole: "ffmpeg plans" },
  { id: "render", dept: "Deliverables", label: "Render farm", href: "/render", status: "bridge", studioRole: "Plan handoff — farm executes elsewhere" },
  { id: "presets", dept: "Brand", label: "Lane presets", href: "/presets", status: "planner", studioRole: "TSWS lane notes" },
  { id: "archive", dept: "Archive", label: "Archive", href: "/archive", status: "operational", studioRole: "Cold checklist" },
  { id: "collab", dept: "Studio", label: "Collaboration", href: "/collab", status: "operational", studioRole: "Roles" },
  { id: "hardware", dept: "Infrastructure", label: "Hardware reference", href: "/hardware", status: "operational", studioRole: "Suite specs · storage · farm" },
];

export function modulesByDept(): Record<string, StudioModule[]> {
  const map: Record<string, StudioModule[]> = {};
  for (const m of STUDIO_MODULES) {
    (map[m.dept] ||= []).push(m);
  }
  return map;
}
