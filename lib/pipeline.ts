export type PipelineStage =
  | "ingest"
  | "proxy"
  | "assembly"
  | "grade"
  | "audio"
  | "captions"
  | "review"
  | "export";

export type DeliverableFormat =
  | "master-horizontal"
  | "vertical-9x16"
  | "square-1x1"
  | "web-720"
  | "proxy";

export const PIPELINE_STAGES: {
  id: PipelineStage;
  label: string;
  inspiredBy: string;
  restraintNote: string;
}[] = [
  { id: "ingest", label: "Ingest / bin", inspiredBy: "Premiere bins · Resolve media pool", restraintNote: "Organize only. No look change." },
  { id: "proxy", label: "Proxy", inspiredBy: "Premiere / Resolve proxies", restraintNote: "Speed for edit. Preserve master." },
  { id: "assembly", label: "Assembly timeline", inspiredBy: "All NLEs", restraintNote: "Structure story before grade." },
  { id: "grade", label: "Restraint grade", inspiredBy: "DaVinci Resolve color", restraintNote: "Subtle only. No hero look." },
  { id: "audio", label: "Sound hierarchy", inspiredBy: "Fairlight · Premiere Essential Sound", restraintNote: "VO > music > ambience. Tactile, not loud." },
  { id: "captions", label: "Captions / text", inspiredBy: "CapCut · Descript", restraintNote: "Minimal chrome. Readable, not template spam." },
  { id: "review", label: "Review + rubric", inspiredBy: "Studio QC", restraintNote: "Human gate before export." },
  { id: "export", label: "Deliverables", inspiredBy: "Resolve deliver · CapCut export", restraintNote: "Rubric pass required for master." },
];

export const DELIVERABLES: {
  id: DeliverableFormat;
  label: string;
  width: number;
  height: number;
  use: string;
}[] = [
  { id: "master-horizontal", label: "Master 16:9", width: 1920, height: 1080, use: "YouTube / feature / TSWS long" },
  { id: "vertical-9x16", label: "Vertical 9:16", width: 1080, height: 1920, use: "Shorts / Reels / TikTok" },
  { id: "square-1x1", label: "Square 1:1", width: 1080, height: 1080, use: "Feed / secondary" },
  { id: "web-720", label: "Web 720p", width: 1280, height: 720, use: "Lightweight review" },
  { id: "proxy", label: "Edit proxy", width: 1280, height: 720, use: "Internal edit only" },
];
