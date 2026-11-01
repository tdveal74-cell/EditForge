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
  { id: "av-tqo-teach", title: "TQO presenter teach via HeyGen", status: "draft", scriptPreview: "Three steps. No hype.", designSource: "monochrome" },
];

/**
 * What EditForge actually does when an avatar job runs.
 *
 * This used to describe the HyperFrames MCP tools — compose, get_project_status,
 * render_video — which is a flow an assistant drives by hand in another client,
 * not one this studio could execute. The avatar provider is now wired through
 * the same boundary as everything else, so the steps below are the steps the
 * job runner takes.
 */
export const AVATAR_FLOW = [
  "POST /v3/videos {type, avatar_id, voice_id, script} → video id",
  "GET /v3/videos/{id} until completed or failed",
  "Completed → video_url recorded on the job as its result",
  "Attach the MP4 to an EditForge cut",
  "Rubric pass before master ship — the gate is not optional",
] as const;

export const AVATAR_ENV = {
  provider: "HEYGEN",
  apiKey: "HEYGEN_API_KEY",
  /** The avatar look to render. HeyGen calls this a look id. */
  avatar: "HEYGEN_AVATAR_ID",
  /** The voice HeyGen speaks the script in. */
  voice: "HEYGEN_VOICE_ID",
} as const;
