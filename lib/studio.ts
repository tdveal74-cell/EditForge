export type ModuleStatus = "operational" | "planner" | "external-engine";

export type StudioModule = {
  id: string;
  dept: string;
  label: string;
  href: string;
  status: ModuleStatus;
  studioRole: string;
};

export const STUDIO_MODULES: StudioModule[] = [
  { id: "pipeline", dept: "Production", label: "Pipeline", href: "/pipeline", status: "operational", studioRole: "Stage map from ingest to deliver" },
  { id: "projects", dept: "Production", label: "Projects / bins", href: "/projects", status: "operational", studioRole: "Cut + package tracking" },
  { id: "dailies", dept: "Production", label: "Dailies", href: "/dailies", status: "operational", studioRole: "Day roll review queue" },
  { id: "script", dept: "Development", label: "Script notes", href: "/script", status: "operational", studioRole: "Scene / continuity notes" },
  { id: "timeline", dept: "Editorial", label: "Timeline", href: "/timeline", status: "operational", studioRole: "Assembly sketch (NLE still primary cutter)" },
  { id: "color", dept: "Color", label: "Restraint grade", href: "/color", status: "operational", studioRole: "Look envelope; Resolve for hero grade" },
  { id: "audio", dept: "Sound", label: "Audio hierarchy", href: "/audio", status: "operational", studioRole: "VO / music / SFX discipline" },
  { id: "captions", dept: "Finishing", label: "Captions", href: "/captions", status: "operational", studioRole: "SRT / text lane" },
  { id: "titles", dept: "Finishing", label: "Titles / motion", href: "/titles", status: "operational", studioRole: "Minimal title cards — no template spam" },
  { id: "assets", dept: "MAM", label: "Assets", href: "/assets", status: "operational", studioRole: "Media library index" },
  { id: "review", dept: "QC", label: "Review", href: "/review", status: "operational", studioRole: "Frame notes + approvals" },
  { id: "rubric", dept: "QC", label: "Restraint rubric", href: "/rubric", status: "operational", studioRole: "Ship gate" },
  { id: "export", dept: "Deliverables", label: "Export", href: "/export", status: "operational", studioRole: "Format matrix + ffmpeg plans" },
  { id: "jobs", dept: "Deliverables", label: "Transcode jobs", href: "/jobs", status: "operational", studioRole: "Proxy / export plans" },
  { id: "presets", dept: "Brand", label: "Lane presets", href: "/presets", status: "operational", studioRole: "TSWS / faceless / shorts" },
  { id: "archive", dept: "Archive", label: "Archive", href: "/archive", status: "operational", studioRole: "Cold storage checklist" },
  { id: "collab", dept: "Studio", label: "Collaboration", href: "/collab", status: "operational", studioRole: "Roles + handoff" },
  { id: "vfx", dept: "VFX", label: "VFX board", href: "/vfx", status: "planner", studioRole: "Shot tracker — Fusion/AE external" },
];

export function modulesByDept(): Record<string, StudioModule[]> {
  const map: Record<string, StudioModule[]> = {};
  for (const m of STUDIO_MODULES) {
    (map[m.dept] ||= []).push(m);
  }
  return map;
}
