/**
 * Desktop groups and the ~390px priority strip.
 *
 * Hardware is a Board (reference classes), not a Bridge. Putting it under
 * Bridges made the bar file a sketch as a file-handoff engine.
 */
export const NAV_GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Create",
    links: [
      { href: "/studio", label: "Studio" },
      { href: "/pipeline", label: "Pipeline" },
      { href: "/projects", label: "Projects" },
      { href: "/timeline", label: "Timeline" },
    ],
  },
  {
    label: "AI media",
    links: [
      { href: "/voice", label: "Voice" },
      { href: "/avatar", label: "Avatar" },
      { href: "/gen-video", label: "Gen video" },
      { href: "/stock", label: "Stock" },
    ],
  },
  {
    label: "Finish",
    links: [
      { href: "/color", label: "Grade" },
      { href: "/longform", label: "Long-form" },
      { href: "/rubric", label: "Rubric" },
      { href: "/export", label: "Export" },
    ],
  },
  {
    label: "Bridges",
    links: [
      { href: "/nle", label: "NLE" },
      { href: "/render", label: "Render" },
    ],
  },
  {
    label: "Reference",
    links: [{ href: "/hardware", label: "Hardware" }],
  },
];

/** Visible on ~390px. Everything else lives in More so the bar cannot overflow. */
export const MOBILE_PRIORITY = [
  { href: "/studio", label: "Studio" },
  { href: "/dailies", label: "Dailies" },
  { href: "/review", label: "Review" },
];

export const MOBILE_MORE = [
  { href: "/gen-video", label: "Gen video" },
  { href: "/voice", label: "Voice" },
  { href: "/avatar", label: "Avatar" },
  { href: "/timeline", label: "Timeline" },
  { href: "/rubric", label: "Rubric" },
  { href: "/export", label: "Export" },
  { href: "/jobs", label: "Jobs" },
  { href: "/stock", label: "Stock" },
  { href: "/hardware", label: "Hardware" },
];
