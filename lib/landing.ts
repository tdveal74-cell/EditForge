/**
 * Landing capability copy, kept here so tests can prove it does not name an
 * unwired provider as output.
 */
export const LANDING_CAPABILITIES = [
  {
    title: "Generative video",
    body: "Runway is wired for text-to-video. Other gen providers stay registered and refuse until implemented.",
    href: "/gen-video",
  },
  {
    title: "Voice & avatar",
    body: "Consent-gated clone lanes with simulated labels when anything is mocked.",
    href: "/voice",
  },
  {
    title: "Dailies & review",
    body: "Look first. Approve with reason. Nothing enters a cut unreviewed.",
    href: "/dailies",
  },
  {
    title: "Rubric before master",
    body: "The ship gate is code, not convention. No silent export.",
    href: "/rubric",
  },
] as const;
