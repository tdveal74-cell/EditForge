export type AvatarProject = {
  id: string;
  title: string;
  status: "draft" | "processing" | "ready" | "failed";
  scriptPreview: string;
  designSource?: string;
  externalId?: string;
};

export const SAMPLE_AVATARS: AvatarProject[] = [
  { id: "av-tsws-cold", title: "TSWS cold open — avatar bed", status: "draft", scriptPreview: "Where are we today?", designSource: "signal" },
  { id: "av-faceless-teach", title: "Faceless teach — HyperFrames", status: "ready", scriptPreview: "Three steps. No hype.", designSource: "monochrome" },
];

export const HYPERFRAMES_FLOW = [
  "compose(prompt, designSource?) → project_id",
  "get_project_status(project_id) until draft/completed",
  "render_video(project_id) if separate render needed",
  "get_render_status → video_url",
  "Attach MP4 to EditForge cut + rubric before master ship",
] as const;
